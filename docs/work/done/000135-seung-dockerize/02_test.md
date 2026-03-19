# [#135] chore: services/seung Dockerize — 테스트 결과

> 작성: 2026-03-19

---

## 최종 테스트 결과

### Vitest 단위·컴포넌트 테스트

```
Test Files  11 passed (11)
Tests       89 passed (89)
Duration    14.71s
```

**파일별 결과:**

| 파일 | 테스트 수 | 결과 |
|------|-----------|------|
| `tests/api/questions.test.ts` | 10 | ✅ 전체 통과 |
| `tests/api/interview-start.test.ts` | 6 | ✅ 전체 통과 |
| `tests/api/interview-answer.test.ts` | 10 | ✅ 전체 통과 |
| `tests/api/practice-feedback.test.ts` | 12 | ✅ 전체 통과 |
| `tests/api/report-generate.test.ts` | 9 | ✅ 전체 통과 |
| `tests/api/report-get.test.ts` | 3 | ✅ 전체 통과 |
| `tests/api/resume-feedback.test.ts` | 11 | ✅ 전체 통과 |
| `tests/api/resume-diagnosis.test.ts` | 5 | ✅ 전체 통과 |
| `tests/components/InterviewChat.test.tsx` | 11 | ✅ 전체 통과 |
| `tests/components/QuestionList.test.tsx` | 5 | ✅ 전체 통과 |
| `tests/components/UploadForm.test.tsx` | 7 | ✅ 전체 통과 |

> 이번 이슈는 Dockerize 작업으로 신규 테스트 케이스 없음 — 기존 89개 회귀 없음 확인

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

## Docker 빌드 검증

### 빌드

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=dummy \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy \
  -t mirai-seung:local .
```

| 항목 | 결과 |
|------|------|
| `Loaded Prisma config from prisma.config.ts` | ✅ |
| `✔ Generated Prisma Client (v6.19.2)` | ✅ |
| `✓ Compiled successfully (17개 라우트)` | ✅ |
| 이미지 생성 (`mirai-seung:local`) | ✅ |

### prisma migrate deploy 모듈 로딩 검증 (fake DB)

```bash
docker run --rm \
  -e DATABASE_URL=postgresql://fake:fake@fake:5432/fake \
  -e DIRECT_URL=postgresql://fake:fake@fake:5432/fake \
  -e ENGINE_BASE_URL=http://fake \
  --entrypoint sh mirai-seung:local \
  -c "node node_modules/prisma/build/index.js migrate deploy 2>&1"
```

**결과:**
```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "fake", schema "public" at "fake:5432"

Error: P1001: Can't reach database server at `fake:5432`
```

→ `MODULE_NOT_FOUND` 없음. 모든 의존성 정상 로딩, DB 연결 단계까지 도달 ✅

### entrypoint 동작 확인 (env 없이)

```bash
docker run --rm mirai-seung:local
```

**결과:**
```
ERROR: DATABASE_URL, DIRECT_URL, and ENGINE_BASE_URL must be set
```

→ entrypoint.sh 정상 실행, 3개 env 검증 단계까지 도달 ✅

---

## EC2 배포 검증

```
docker logs seung
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "postgres", schema "public" at "..."

5 migrations found in prisma/migrations
No pending migrations to apply.
▲ Next.js 16.1.6
✓ Ready in 245ms
```

| 항목 | 결과 |
|------|------|
| `prisma migrate deploy` 성공 (`No pending migrations to apply.`) | ✅ |
| Next.js 서버 기동 (`✓ Ready in 245ms`) | ✅ |
| HEALTHCHECK 동작 (`Status: healthy`, `FailingStreak: 0`) | ✅ |
| ALB 헬스체크 통과 (`healthy`) | ✅ |
| `seung.mirainterview.com` 접속 | ✅ |

> pdf-parse 런타임 동작은 PDF 업로드 기능 실제 사용 테스트로 별도 확인 필요

---

## 트러블슈팅 기록

#### `prisma.config.ts` 누락 — migrate deploy PgBouncer 실패

- **현상**: 코드 리뷰 중 발견 (로컬 빌드 전 사전 분석)
- **원인**: `schema.prisma`의 `url = DATABASE_URL`은 PgBouncer Transaction Pooler(port 6543, `?pgbouncer=true`)를 가리킴. Prisma CLI(`migrate deploy`)가 이 URL로 DDL을 실행하면 Transaction Pooler가 DDL을 지원하지 않아 마이그레이션 실패
- **해결**: `prisma.config.ts` 신규 생성 — `datasource.url`을 `DIRECT_URL`(Session Pooler, port 5432)로 오버라이드. Dockerfile deps/builder 스테이지에서 `prisma generate` 시 참조. entrypoint.sh에서 `DATABASE_URL="$DIRECT_URL"` env 오버라이드로 runner에서도 DIRECT_URL 사용 보장
- **참고**: siw 서비스가 동일 문제를 동일 방식으로 해결한 선례 존재

#### `entrypoint.sh` `ENGINE_BASE_URL` 미검증 — 헬스체크 통과 후 API 전체 500

- **현상**: 코드 리뷰 중 발견
- **원인**: `ENGINE_BASE_URL` 없이도 컨테이너가 정상 기동하고 ALB 헬스체크를 통과하지만, 면접·자소서·리포트 등 핵심 API 6개 라우트가 모두 엔진 호출 실패로 500 반환 — "헬스체크 green, 서비스 dead" 상황
- **해결**: entrypoint.sh 검증 조건에 `ENGINE_BASE_URL` 추가. 누락 시 컨테이너가 즉시 종료되어 ALB 헬스체크 실패 → 빠른 문제 감지 가능

#### Prisma CLI 전이 의존성 누락 — `Cannot find module 'effect'` / `'fast-check'`

- **현상**: EC2 배포 후 `docker logs seung`에서 `Cannot find module 'effect'`, 이후 `Cannot find module 'fast-check'` 연속 발생
- **원인**: Prisma 6.x CLI 실행 경로: `prisma/build/index.js` → `@prisma/config` → `effect` → `fast-check` (그 외 추가 전이 의존성 존재 가능). runner 스테이지에서 `.prisma`, `@prisma`, `prisma`, `effect`만 선택적으로 COPY했으나 `fast-check` 등 하위 의존성이 누락됨
- **해결**: runner 스테이지의 선택적 COPY를 제거하고 `COPY --from=builder /app/node_modules ./node_modules` 전체 복사로 교체. 전이 의존성을 버전별로 추적하는 비용과 리스크를 제거. standalone은 자체 node_modules를 포함하므로 이 node_modules는 `migrate deploy` 전용
- **검증**: fake DB URL로 `migrate deploy` 실행 → `P1001` (DB 연결 오류, MODULE_NOT_FOUND 아님) 확인 ✅
