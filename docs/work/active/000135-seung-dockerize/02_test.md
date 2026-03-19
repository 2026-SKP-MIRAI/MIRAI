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

### 컨테이너 내 파일 존재 확인

```bash
docker run --rm --entrypoint sh mirai-seung:local -c "ls \
  node_modules/prisma/build/prisma_schema_build_bg.wasm \
  node_modules/.prisma/client/ \
  node_modules/@prisma/ \
  prisma/ prisma.config.ts \
  node_modules/pdf-parse"
```

| 파일 | 결과 |
|------|------|
| `prisma_schema_build_bg.wasm` | ✅ |
| `.prisma/client/` (linux-musl-openssl-3.0.x 바이너리 포함) | ✅ |
| `@prisma/` (client, engines 등) | ✅ |
| `prisma/` (schema.prisma, migrations/) | ✅ |
| `prisma.config.ts` | ✅ |
| `pdf-parse` | ✅ |

### entrypoint 동작 확인 (DB 없이)

```bash
docker run --rm mirai-seung:local
```

**결과:**
```
ERROR: DATABASE_URL, DIRECT_URL, and ENGINE_BASE_URL must be set
```

→ entrypoint.sh 정상 실행, 3개 env 검증 단계까지 도달 ✅

---

## 미검증 항목 (EC2 배포 후 확인 필요)

| 항목 | 확인 방법 |
|------|-----------|
| `prisma migrate deploy` 성공 | `docker logs seung` 에서 `All migrations have been applied` 확인 |
| Next.js 서버 기동 | `http://seung.mirainterview.com` 접속 |
| HEALTHCHECK 동작 | `docker inspect seung \| grep -A5 Health` |
| ALB 헬스체크 통과 | AWS 콘솔 → 타겟그룹 → `healthy` 상태 확인 |
| pdf-parse 런타임 동작 | PDF 업로드 기능 실제 사용 테스트 |

---

## 트러블슈팅 기록

#### `prisma.config.ts` 누락 — migrate deploy PgBouncer 실패

- **현상**: 코드 리뷰 중 발견 (로컬 빌드 전 사전 분석)
- **원인**: `schema.prisma`의 `url = DATABASE_URL`은 PgBouncer Transaction Pooler(port 6543, `?pgbouncer=true`)를 가리킴. Prisma CLI(`migrate deploy`)가 이 URL로 DDL을 실행하면 Transaction Pooler가 DDL을 지원하지 않아 마이그레이션 실패
- **해결**: `prisma.config.ts` 신규 생성 — `datasource.url`을 `DIRECT_URL`(Session Pooler, port 5432)로 오버라이드. Prisma CLI가 `schema.prisma`보다 `prisma.config.ts`를 우선 참조. Dockerfile deps/runner 스테이지에 `COPY prisma.config.ts` 추가
- **참고**: siw 서비스가 동일 문제를 동일 방식으로 해결한 선례 존재

#### `entrypoint.sh` `ENGINE_BASE_URL` 미검증 — 헬스체크 통과 후 API 전체 500

- **현상**: 코드 리뷰 중 발견
- **원인**: `ENGINE_BASE_URL` 없이도 컨테이너가 정상 기동하고 ALB 헬스체크를 통과하지만, 면접·자소서·리포트 등 핵심 API 6개 라우트가 모두 엔진 호출 실패로 500 반환 — "헬스체크 green, 서비스 dead" 상황
- **해결**: entrypoint.sh 검증 조건에 `ENGINE_BASE_URL` 추가. 누락 시 컨테이너가 즉시 종료되어 ALB 헬스체크 실패 → 빠른 문제 감지 가능
