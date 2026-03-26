# [#219] chore: [kwan] ECR + EC2 Docker CI/CD 파이프라인 구축 — 테스트 결과

> 작성: 2026-03-25

---

## 상태 범례

| 아이콘 | 의미 |
|--------|------|
| ⬜ | 미검증 |
| 🔴 | 실패 확인 |
| 🟢 | 성공 확인 |
| ✅ | 완료 |
| ❌ | 실패 (수정 필요) |

---

## Vitest 단위·컴포넌트 테스트

> 이번 이슈는 Dockerize + CI/CD 파이프라인 작업으로 신규 테스트 케이스 없음.
> 기존 14개 파일 112개 TC 회귀 없음 확인 (`.ai.md` 기준).
> `schemas.ts` / `types.ts` 수정(AxisScores nullable, not_evaluated 추가)으로 스키마·타입 변경이 있었으나 기존 테스트는 모두 통과.

---

## Docker 빌드 검증

### 빌드

```bash
cd services/kwan
docker build -t mirai-kwan:test .
```

| 항목 | 결과 |
|------|------|
| `npx prisma generate` | ✅ |
| `npm run build` (Next.js 16.1.6) | ✅ |
| 이미지 생성 (`mirai-kwan:test`) | ✅ |

### entrypoint 동작 확인 (env 없이)

```bash
docker run --rm mirai-kwan:test
```

**결과:**
```
ERROR: DATABASE_URL, DIRECT_URL, and ENGINE_BASE_URL must be set
```

→ entrypoint.sh 정상 실행, 3개 env 검증 단계까지 도달 ✅

### prisma migrate deploy 모듈 로딩 검증

```bash
docker run --rm \
  -e DATABASE_URL=postgresql://fake:fake@fake:5432/fake \
  -e DIRECT_URL=postgresql://fake:fake@fake:5432/fake \
  -e ENGINE_BASE_URL=http://fake \
  --entrypoint sh mirai-kwan:test \
  -c "node node_modules/prisma/build/index.js migrate deploy 2>&1"
```

**결과:**
```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "fake", schema "public" at "fake:5432"

Error: P1001: Can't reach database server at `fake:5432`
```

→ `MODULE_NOT_FOUND` 없음. 모든 의존성 정상 로딩, DB 연결 단계까지 도달 ✅

### 로컬 실행 + 헬스체크

```bash
docker run --env-file .env.docker -p 3000:3000 mirai-kwan:test
curl http://localhost:3000/api/health
```

**결과:**
```json
{"status":"ok"}
```

→ `GET /api/health` 200 응답 ✅

---

## EC2 배포 검증

### 컨테이너 시작 로그

```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "postgres", schema "public" at "aws-1-ap-southeast-1.pooler.supabase.com:5432"

1 migration found in prisma/migrations


No pending migrations to apply.
▲ Next.js 16.1.6
- Local:         http://localhost:3000
- Network:       http://0.0.0.0:3000

✓ Starting...
✓ Ready in 280ms
```

| 항목 | 결과 |
|------|------|
| `prisma migrate deploy` 성공 (`No pending migrations to apply.`) | ✅ |
| Next.js 서버 기동 (`✓ Ready in 280ms`) | ✅ |
| `GET /api/health` → `{"status":"ok"}` | ✅ |
| HEALTHCHECK 동작 (`Status: healthy`, `FailingStreak: 0`) | ✅ |
| ALB 헬스체크 통과 (`healthy`) | ✅ |
| `kwan.mirainterview.com` 접속 | ✅ |

### end-to-end 기능 검증

> 트러블슈팅(WAF 규칙, 엔진 버전, 스키마 수정) 해결 후 최종 재확인.
> 특히 리포트 생성은 `schemas.ts` / `types.ts` 수정 후 재검증.

| 기능 | 결과 |
|------|------|
| PDF 자소서 업로드 → 질문 생성 | ✅ |
| 면접 시작 → 답변 → 꼬리질문 | ✅ |
| 면접 완료 → 리포트 생성 (스키마 수정 후 재확인) | ✅ |

---

## 트러블슈팅 기록

### TypeScript 빌드 에러 — `encodeURIComponent(resumeId)` null 불허

- **현상**: `docker build` 중 `npm run build` 실패. `src/app/diagnosis/page.tsx:149` — `Type 'string | null' is not assignable to parameter of type 'string | number | boolean'`
- **원인**: `resumeId`가 `string | null` 타입인데 `encodeURIComponent`는 null을 허용하지 않음
- **해결**: `encodeURIComponent(resumeId ?? '')` — nullish coalescing 적용. 실제 런타임에서 `resumeId`는 useEffect에서 null이면 홈으로 redirect되므로 빈 문자열 도달 가능성 없음

### 엔진 EC2 연결 실패 — `ENGINE_BASE_URL` IP 직접 참조 불가

- **현상**: `kwan.mirainterview.com`에서 자소서 분석 시 "서버 오류" 반환
- **원인**: `~/.env.kwan`의 `ENGINE_BASE_URL=http://13.125.122.151:8000` — 엔진 EC2 보안 그룹이 ALB SG에서 오는 트래픽만 허용. 직접 IP 접근 차단
- **해결**: `ENGINE_BASE_URL=http://mirai-engine-ALB-989667550.ap-northeast-2.elb.amazonaws.com` — 엔진 ALB 주소로 변경

### 엔진 버전 불일치 — `/api/resume/analyze` 404

- **현상**: 질문 생성 시도 시 404. 엔진 EC2가 5일 전 이미지로 실행 중
- **원인**: 엔진 EC2의 Docker 이미지가 `/api/resume/analyze` 엔드포인트가 없는 구버전. 엔진은 아직 ECR 기반 자동 배포 파이프라인이 없어 수동 배포 상태였음 (관련 이슈 #244)
- **해결**: 엔진 EC2 SSH 접속 → `git pull origin main` → `docker build -t mirai-engine:latest .` → 컨테이너 재시작 (임시 수동 조치)

### WAF 차단 — `AWSManagedRulesAmazonIpReputationList` + `AWSManagedRulesCommonRuleSet`

- **현상**: PDF 업로드 시 403 반환
- **원인**: WAF `AWSManagedRulesAmazonIpReputationList` — IP 평판 차단. `AWSManagedRulesCommonRuleSet` — `SizeRestrictions_BODY`, `CrossSiteScripting_BODY`, `EC2MetaDataSSRF_BODY` 등 PDF 내용 패턴 오탐
- **해결**: WAF Web ACL 규칙 재정의 — `AWSManagedRulesAmazonIpReputationList` 전체 Count, `AWSManagedRulesCommonRuleSet`의 해당 규칙들 Count (seung과 동일한 설정 적용)

### 리포트 생성 500 — `AxisScores` / `AxisFeedbackSchema` 스키마 불일치

- **현상**: 면접 완료 후 리포트 생성 시 500. 엔진은 200 반환
- **원인**: 엔진 #197에서 `not_evaluated` 타입과 nullable score 도입. kwan `schemas.ts`가 구버전 스키마(`type: 'strength' | 'improvement'`, `score: z.number()`)를 사용해 Zod 파싱 실패
- **해결**:
  - `AxisScoresSchema` — 8개 필드 모두 `.nullable()` 추가
  - `AxisFeedbackSchema` — `score: z.number().nullable()`, `type` enum에 `'not_evaluated'` 추가
  - `types.ts` — `AxisScores` / `AxisFeedback` 타입 정의 동기화

### EC2 디스크 부족 — `no space left on device`

- **현상**: ECR 이미지 pull 후 `failed to register layer: write ... no space left on device`
- **원인**: EC2 루트 볼륨 6.8GB 중 5.4GB 사용. `/home/ubuntu/MIRAI` 클론(858MB), AWS CLI 설치 파일(321MB), apt 캐시(119MB) 등 잔존
- **해결**: `rm -rf ~/MIRAI ~/aws ~/awscliv2.zip && sudo apt clean` → 1.4GB → 2.6GB 확보 후 재시도
