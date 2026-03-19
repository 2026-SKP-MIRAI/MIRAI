# [#151] feat: [seung] Supabase Auth 연동 — 테스트 결과

> 작성: 2026-03-19

---

## 최종 테스트 결과

### next build

```
▲ Next.js 16.1.6 (Turbopack)

✓ Compiled successfully
✓ Generating static pages (20/20)
```

Route (app) — 20개 라우트 전체 빌드 통과 (Dynamic / Proxy 포함)

### Vitest 단위 테스트

```
Test Files  12 passed (12)
Tests       113 passed (113)
Duration    2.77s
```

**파일별 결과:**

| 파일 | 테스트 수 | 결과 | 비고 |
|------|-----------|------|------|
| `tests/api/questions.test.ts` | 16 | ✅ 전체 통과 | +1 신규 (미인증 401) |
| `tests/api/interview-start.test.ts` | 8 | ✅ 전체 통과 | +2 신규 (미인증 401, 타인 resume 404) |
| `tests/api/interview-answer.test.ts` | 12 | ✅ 전체 통과 | +2 신규 (미인증 401, 타인 세션 403) |
| `tests/api/interview-session.test.ts` | 6 | ✅ 전체 통과 | 신규 파일 (200/400/401/403/404/500) |
| `tests/api/report-generate.test.ts` | 11 | ✅ 전체 통과 | +2 신규 (미인증 401, 타인 세션 403) |
| `tests/api/report-get.test.ts` | 5 | ✅ 전체 통과 | +2 신규 (미인증 401, 타인 리포트 403) |
| `tests/api/resume-feedback.test.ts` | 13 | ✅ 전체 통과 | +2 신규 (미인증 401, 타인 resume 403) |
| `tests/api/resume-diagnosis.test.ts` | 7 | ✅ 전체 통과 | +2 신규 (미인증 401, 타인 resume 403) |
| `tests/api/practice-feedback.test.ts` | 12 | ✅ 전체 통과 | 변경 없음 (인증 미추가) |
| `tests/components/InterviewChat.test.tsx` | 11 | ✅ 전체 통과 | 변경 없음 |
| `tests/components/QuestionList.test.tsx` | 5 | ✅ 전체 통과 | 변경 없음 |
| `tests/components/UploadForm.test.tsx` | 7 | ✅ 전체 통과 | 변경 없음 |

---

## 상태 범례

| 아이콘 | 의미 |
|--------|------|
| ⬜ | 미구현 |
| 🔴 | RED — 테스트 작성 완료, 실패 확인 |
| 🟢 | GREEN — 구현 완료, 테스트 통과 |
| ✅ | DONE — 리팩토링 완료 |
| ❌ | FAIL — 테스트 실패 (수정 필요) |

---

## 변경 파일 및 수정 내용

### 신규 파일

| 파일 | 내용 | 결과 |
|------|------|------|
| `src/lib/supabase/browser.ts` | createBrowserClient (NEXT_PUBLIC_ 키) | ✅ |
| `src/lib/supabase/server.ts` | createServerClient async — `await cookies()` (Next.js 16) | ✅ |
| `src/middleware.ts` | 세션 갱신 + 보호 라우트 리다이렉트 | ✅ |
| `src/app/login/page.tsx` | 이메일/비밀번호 로그인, safe redirectTo 검증 | ✅ |
| `src/app/signup/page.tsx` | 이메일/비밀번호 회원가입 + 확인 이메일 안내 | ✅ |
| `src/app/auth/callback/route.ts` | exchangeCodeForSession(code) | ✅ |
| `supabase/migrations/add_rls.sql` | RLS 정책 3개 테이블 | ✅ |
| `tests/api/interview-session.test.ts` | GET /api/interview/session 전체 케이스 (6개) | ✅ |

### 수정 파일

| 파일 | 변경 | 결과 |
|------|------|------|
| `src/app/layout.tsx` | async Server Component — getUser() + 로그아웃 Server Action | ✅ |
| `prisma/schema.prisma` | Resume·InterviewSession·Report에 `userId String?` 추가 | ✅ |
| `src/app/api/resume/questions/route.ts` | getUser() 401 + resume.create에 userId 저장 | ✅ |
| `src/app/api/interview/start/route.ts` | getUser() 401 + `where: { id, userId }` 소유권 + session.create에 userId | ✅ |
| `src/app/api/interview/session/route.ts` | getUser() 401 + select에 userId + 403 소유권 검증 | ✅ |
| `src/app/api/interview/answer/route.ts` | getUser() 401 + userId 타입 명시 + 403 소유권 검증 | ✅ |
| `src/app/api/resume/feedback/route.ts` | getUser() 401 + 403 소유권 검증 | ✅ |
| `src/app/api/resume/diagnosis/route.ts` | getUser() 401 + select에 userId + 403 소유권 검증 | ✅ |
| `src/app/api/report/route.ts` | getUser() 401 + userId 타입 명시 + 403 소유권 검증 | ✅ |
| `src/app/api/report/generate/route.ts` | getUser() 401 + 403 소유권 검증 + report.create에 userId | ✅ |
| `tests/api/interview-answer.test.ts` | supabase mock 추가, mockSession에 userId, 401/403 케이스 | ✅ |
| `tests/api/interview-start.test.ts` | supabase mock 추가, 401/404 케이스 | ✅ |
| `tests/api/questions.test.ts` | supabase mock 추가, create 호출에 userId 검증, 401 케이스 | ✅ |
| `tests/api/report-generate.test.ts` | supabase mock 추가, mockSession에 userId, 401/403 케이스 | ✅ |
| `tests/api/report-get.test.ts` | supabase mock 추가, mockReport에 userId, 401/403 케이스 | ✅ |
| `tests/api/resume-diagnosis.test.ts` | supabase mock 추가, mock resume에 userId, 401/403 케이스 | ✅ |
| `tests/api/resume-feedback.test.ts` | supabase mock 추가, mock resume에 userId, 401/403 케이스 | ✅ |

---

## 트러블슈팅 기록

### `prisma migrate dev` — DIRECT_URL 미인식

- **현상**: `npx prisma migrate dev` 실행 시 DIRECT_URL 환경변수 미인식으로 마이그레이션 실패
- **원인**: `prisma.config.ts`가 직접 env 로딩을 우회함 — dotenv 자동 적용 안 됨
- **해결**: `source .env.local && npx prisma migrate dev --name add_user_id` 로 실행

### `interview/answer/route.ts` TypeScript 빌드 오류

- **현상**: `next build` 시 `Property 'userId' does not exist on type '{ id: string; resumeId: string; ... }'` 오류
- **원인**: 해당 파일에 `session` 변수에 명시적 타입 어노테이션이 있었고 `userId`가 누락된 상태
- **해결**: 타입 어노테이션에 `userId: string | null` 추가 (다른 라우트는 select 없어 Prisma가 자동 추론)

### `resume-diagnosis.test.ts` — 403 대신 404 기대 실패

- **현상**: `diagnosisResult null이면 404 반환` 테스트가 403을 받아 실패
- **원인**: 해당 mock 객체에 `userId: 'user-1'`이 없어 소유권 검증(`null !== 'user-1'`)에서 403 선반환
- **해결**: mock 객체에 `userId: 'user-1'` 추가

### ⚠️ 배포 시 수동 적용 필요 — RLS SQL

- **내용**: `supabase/migrations/add_rls.sql`은 Prisma 마이그레이션(`entrypoint.sh`의 `prisma migrate deploy`)에 포함되지 않음
- **이유**: RLS 정책은 Prisma가 아닌 Supabase 직접 실행이 필요
- **조치**: 배포 후 Supabase 콘솔 → SQL Editor에서 `add_rls.sql` 내용을 직접 실행해야 함

---

### `auth/callback/route.ts` — exchangeCodeForSession 실패 무시 (코드리뷰 #1)

- **현상**: `exchangeCodeForSession` 실패 시 에러를 무시하고 `/resume`로 리다이렉트
- **원인**: `{ error }` 미구조분해 — 에러 여부 확인 없이 항상 성공 경로 실행
- **해결**: `{ error }` 구조분해 후 에러 시 `/login?error=invalid_code`로 리다이렉트, `login/page.tsx`에서 URL 파라미터 감지해 에러 메시지 표시

---

### Next.js 16 middleware 파일명 경고

- **현상**: `"middleware" file convention is deprecated. Please use "proxy" instead.` 경고 출력
- **원인**: Next.js 16에서 `middleware.ts` → `proxy.ts` 파일명 컨벤션으로 변경 예고
- **판단**: 경고만 출력, 빌드·동작 모두 정상. 파일명 변경은 별도 이슈에서 처리
