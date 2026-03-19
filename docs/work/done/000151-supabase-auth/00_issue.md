# feat: [seung] Supabase Auth 연동 — 회원가입·로그인·보호 라우트

## 사용자 관점 목표
회원가입·로그인 후 면접 서비스를 이용할 수 있고, 미인증 사용자는 자동으로 로그인 페이지로 리다이렉트된다. 모든 면접·진단 데이터가 로그인한 사용자에게 귀속된다.

## 배경
현재 `services/seung`는 Supabase 패키지 미설치 상태로 인증 없이 모든 라우트에 접근 가능하다. `Resume`, `InterviewSession`, `Report` 테이블에 userId가 없어 데이터가 사용자별로 분리되지 않으며, 세션 소유권 검증도 불가능하다. Supabase Auth(`@supabase/ssr`)를 사용해 0에서 인증 레이어를 구축한다.

## 완료 기준
- [x] `@supabase/ssr`, `@supabase/supabase-js` 설치 + `src/lib/supabase/browser.ts`, `server.ts` 신규 생성
- [x] `middleware.ts` 신규 생성 — 세션 갱신 + 미인증 시 `/login` 리다이렉트 (보호 경로: `/resume`, `/interview`, `/report`, `/diagnosis`)
- [x] `/login`, `/signup` 페이지 구현 (이메일/비밀번호), 로그아웃 버튼 (`layout.tsx`)
- [x] `Resume`, `InterviewSession`, `Report` 테이블에 `userId` 컬럼 추가 + Prisma 마이그레이션
- [x] `/api/resume/questions`, `/api/interview/start`에서 인증된 userId 저장
- [x] `/api/interview/session`, `/api/interview/answer`, `/api/resume/diagnosis`에서 소유권 검증 (타인 세션 접근 차단)
- [x] RLS SQL 마이그레이션 (`resumes`, `interview_sessions`, `reports` 테이블)
- [x] `next build` 통과, Vitest 회귀 없음

## 구현 플랜
1. `@supabase/ssr` 설치 + `src/lib/supabase/browser.ts`(createBrowserClient), `server.ts`(createServerClient) 생성
2. `middleware.ts` 신규 생성 — `getUser()`로 세션 갱신, 보호 경로 matcher 설정, `?redirectTo` 파라미터 외부 URL 차단
3. `/login`, `/signup` 페이지 구현 + `layout.tsx` 로그아웃 버튼
4. Prisma 스키마 `userId String?` 컬럼 추가 (`Resume`, `InterviewSession`, `Report`) + migrate + RLS SQL
5. API 라우트 업데이트 — userId 저장 + 소유권 검증
6. Vitest + E2E 테스트 추가

## 개발 체크리스트
- [x] 테스트 코드 포함
- [x] 해당 디렉토리 .ai.md 최신화
- [x] 불변식 위반 없음 (`SUPABASE_SERVICE_ROLE_KEY` 클라이언트 번들 노출 금지)

---

## 작업 내역

### 신규 파일 (8개)

- **`src/lib/supabase/browser.ts`** — `createBrowserClient` 헬퍼. Client Component에서 사용.
- **`src/lib/supabase/server.ts`** — `createServerClient` async 헬퍼. Next.js 16에서 `cookies()`가 Promise를 반환하므로 `await cookies()` 필수.
- **`src/middleware.ts`** — 모든 요청에서 세션 갱신 수행. `/resume`, `/interview`, `/report`, `/diagnosis` 경로는 미인증 시 `/login?redirectTo={pathname}`으로 리다이렉트. API 라우트는 세션 갱신만 하고 리다이렉트 없음(각 handler에서 401 반환).
- **`src/app/login/page.tsx`** — 이메일/비밀번호 로그인. `?redirectTo` 파라미터로 로그인 후 원래 페이지 복귀. 외부 URL 오픈 리다이렉트 차단.
- **`src/app/signup/page.tsx`** — 회원가입 후 이메일 확인 안내.
- **`src/app/auth/callback/route.ts`** — OAuth 이메일 인증 콜백. `exchangeCodeForSession(code)` 처리.
- **`supabase/migrations/add_rls.sql`** — `Resume`, `InterviewSession`, `Report` 테이블 RLS 정책. Supabase 콘솔에서 직접 적용.
- **`tests/api/interview-session.test.ts`** — `GET /api/interview/session` 전체 케이스 신규 작성 (200/400/401/403/404/500).

### 수정 파일

- **`src/app/layout.tsx`** — async Server Component로 전환. `getUser()`로 로그인 여부 확인 후 로그아웃 버튼 렌더. 로그아웃은 Server Action으로 처리.
- **`prisma/schema.prisma`** — `Resume`, `InterviewSession`, `Report` 모델에 `userId String?` 추가. nullable로 기존 데이터 무중단 호환.
- **`src/app/api/resume/questions/route.ts`** — `getUser()` 401 + `prisma.resume.create`에 `userId: user.id` 저장.
- **`src/app/api/interview/start/route.ts`** — `getUser()` 401 + `where: { id: resumeId, userId: user.id }`로 소유권 검증(타인 resume → 404) + session create에 `userId` 저장.
- **`src/app/api/interview/session/route.ts`** — `getUser()` 401 + select에 `userId` 추가 + 소유권 검증 403.
- **`src/app/api/interview/answer/route.ts`** — `getUser()` 401 + session 타입에 `userId: string | null` 명시 + 소유권 검증 403.
- **`src/app/api/resume/feedback/route.ts`** — `getUser()` 401 + 소유권 검증 403.
- **`src/app/api/resume/diagnosis/route.ts`** — `getUser()` 401 + select에 `userId` 추가 + 소유권 검증 403.
- **`src/app/api/report/route.ts`** — `getUser()` 401 + 타입에 `userId: string | null` 명시 + 소유권 검증 403.
- **`src/app/api/report/generate/route.ts`** — `getUser()` 401 + 소유권 검증 403 + `prisma.report.create`에 `userId` 저장.
- **기존 테스트 7개** — `vi.hoisted`에 `mockCreateClient` 추가, `beforeEach`에 인증 mock 설정, mock 객체에 `userId: 'user-1'` 추가, 401/403 케이스 신규 추가.

### 기술적 결정

- `userId === null` (기존 레거시 데이터) → 소유권 검증에서 403 처리. 레거시 데이터 접근 차단이 보안상 더 안전.
- `/api/practice/feedback`은 인증 미추가. DB 조회 없는 stateless 엔진 호출이므로 비로그인 사용자도 연습 기능 사용 가능하게 유지.
- RLS는 직접 DB 접근 차단용 추가 방어선. 주된 소유권 검증은 API 레이어에서 수행.

### ⚠️ 배포 시 수동 적용 필요

`supabase/migrations/add_rls.sql`은 Prisma 마이그레이션에 포함되지 않으므로 **배포 시 Supabase 콘솔 → SQL Editor에서 직접 실행**해야 한다.
