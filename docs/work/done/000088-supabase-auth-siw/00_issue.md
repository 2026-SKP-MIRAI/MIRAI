# feat: Supabase Auth 연동 — 회원가입·로그인·보호 라우트·미들웨어 (siw)

## 사용자 관점 목표

회원가입·로그인 후 앱 내부 라우트(/dashboard, /resumes, /interview/new 등)에 접근할 수 있고, 미인증 사용자는 랜딩 → 로그인 페이지로 자동 리다이렉트된다.

## 배경

- Supabase 클라이언트는 이미 존재: `browser.ts` (createBrowserClient), `server.ts` (createServiceClient — service role 전용)
- `middleware.ts` 미존재 — 현재 모든 라우트 인증 없이 접근 가능
- `InterviewSession.userId String?` 필드 존재 — auth 연동 후 실제 userId 저장 예정
- `dev_spec.md` §인증: Supabase Auth (`@supabase/ssr`), Better Auth 미사용
- `services/siw/.ai.md`: `createServerClient` + `middleware.ts` (`getUser()`로 세션 갱신 필수) 명시

## 완료 기준

- [x] `middleware.ts` — `@supabase/ssr` createServerClient로 세션 갱신, 미인증 시 `/login` 리다이렉트 (보호 경로: `/dashboard`, `/resumes`, `/interview/*`, `/growth`)
- [x] `src/lib/supabase/server.ts` 개편 — SSR용 `createServerClient` 함수 추가 (기존 service client는 유지)
- [x] 로그인 페이지 `/login` — 이메일/비밀번호 + Google OAuth 실제 구현 (`supabase.auth.signInWithOAuth({ provider: 'google' })`), glassmorphism 디자인
- [x] 회원가입 페이지 `/signup` — 이메일/비밀번호 입력, 완료 후 `/dashboard` 이동
- [x] 랜딩 페이지 "시작하기" CTA → 미인증 시 `/login`, 인증 시 `/dashboard`
- [x] 앱 내부 레이아웃(`(app)/layout.tsx`)에 로그아웃 버튼 (Sidebar 하단 또는 헤더)
- [x] `InterviewSession` 생성 시 `userId` 실제 저장 (`/api/interview/start` route 업데이트)
- [x] vitest: 미들웨어 리다이렉트 케이스, 로그인·회원가입 폼 유효성 테스트

### 보안 강화 항목
- [x] 에러 메시지 통일 — "이메일 또는 비밀번호가 올바르지 않습니다" (이메일 열거 공격 방어)
- [x] Open Redirect 방어 — `?redirectTo` 파라미터가 외부 URL일 경우 차단 (`/` 시작 여부 검증)
- [x] 비밀번호 정책 — 최소 8자·영문+숫자 조합 Zod 검증 (클라이언트 + 서버 양쪽)
- [ ] Rate limiting — Supabase Auth 설정에서 로그인 연속 실패 횟수 제한 활성화 _(운영 설정 — 코드 외)_
- [x] RLS 완전성 검증 — `interview_sessions` RLS 활성화 + users_own_sessions 정책 추가
- [x] `NEXT_PUBLIC_` 키 감사 — `createServiceClient`는 서버 전용, 클라이언트 번들 미노출
- [ ] Google OAuth redirect URI — Google Cloud Console에서 허용 URI 최소화 _(운영 설정 — 코드 외)_

## 구현 플랜

### Step 1 — `src/lib/supabase/server.ts` 개편

```ts
// SSR 세션용 (미들웨어·서버 컴포넌트·API Route에서 사용)
export function createServerClient(cookieStore: ReadonlyRequestCookies) { ... }

// 기존 service role 유지 (RLS 우회 필요한 경우)
export function createServiceClient() { ... }
```

### Step 2 — `middleware.ts` 신규 (`services/siw/src/middleware.ts`)

```ts
// 보호 경로 매처
export const config = {
  matcher: ["/dashboard/:path*", "/resumes/:path*", "/interview/:path*", "/growth/:path*"],
}

// getUser() → 미인증 시 /login redirect
// 세션 쿠키 갱신 (supabase.auth.getUser() 호출 필수)
// redirectTo 파라미터 검증 (외부 URL 차단)
```

### Step 3 — 로그인·회원가입 페이지

- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/signup/page.tsx`
- `src/app/(auth)/layout.tsx` — 인증 전용 레이아웃 (Sidebar 없음, 로고 + 카드 중앙 배치)
- 에러 메시지: 통일된 한국어 메시지 (이메일 열거 방지)
- 성공 후 redirect: signup → 이메일 확인 안내 or `/dashboard`, login → `/dashboard`

### Step 4 — Google OAuth 연동

```ts
// Supabase Auth Google OAuth
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${origin}/auth/callback` }
})
```
- Google Cloud Console OAuth 클라이언트 ID + redirect URI 설정 필요
- `src/app/auth/callback/route.ts` — OAuth 콜백 처리

### Step 5 — 랜딩 CTA + 앱 레이아웃 로그아웃

- `(landing)/page.tsx`: "시작하기" 버튼 → `supabase.auth.getUser()` 체크 → `/dashboard` or `/login`
- `(app)/layout.tsx` 또는 `Sidebar.tsx` 하단: 로그인된 이메일 표시 + 로그아웃 버튼

### Step 6 — InterviewSession userId 저장

- `/api/interview/start` route: `createServerClient`로 `getUser()` → `session.user.id` → DB 저장
- 기존 `userId: null` mock 세션은 그대로 유지 (마이그레이션 불필요)

### Step 7 — RLS 설정 (SQL 마이그레이션)

```sql
-- interview_sessions RLS
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can access own sessions"
  ON interview_sessions FOR ALL
  USING (user_id = auth.uid());
```

> Prisma로 생성된 테이블은 RLS 자동 활성화 안됨 — 별도 SQL 필수 (`.ai.md` 명시)

## 의존성

- 이슈 #87 (내비게이션 4탭) — 보호 라우트 대상 경로 확정 후 matcher 설정
- 이슈 #89 (이력서 저장) — auth userId로 per-user 이력서 조회 (이 이슈 완료 후 진행)

## 개발 체크리스트

- [ ] 테스트 코드 포함
- [ ] `services/siw/.ai.md` 최신화
- [ ] 불변식 위반 없음 (`SUPABASE_SERVICE_ROLE_KEY` 클라이언트 번들 노출 금지)
- [ ] 기존 인터뷰 세션 흐름 회귀 없음 확인

---

## 작업 내역

### 신규 파일

**`src/middleware.ts`**
- `@supabase/ssr`의 `createServerClient`로 요청마다 세션 쿠키를 갱신
- `getUser()` 호출(getSession() 사용 금지) → 미인증 시 `/login?redirectTo={pathname}` 리다이렉트
- Open Redirect 방어: `redirectTo`가 `/`로 시작하고 `//`로 시작하지 않을 때만 허용
- matcher: `/dashboard`, `/resumes`, `/interview`, `/growth` 하위 전체

**`src/lib/supabase/server.ts`** (기존 파일 개편)
- `createServerClient(cookieStore)` 추가 — SSR/미들웨어/API Route에서 세션 쿠키 읽기·쓰기
- 기존 `createServiceClient()` 유지 — RLS 우회 필요 시 서버 전용 사용

**`src/lib/auth/schemas.ts`**
- Zod `passwordSchema`: 8자 이상, 영문+숫자 조합 강제
- `loginSchema`: email + password
- `signupSchema`: name + email + password + confirmPassword (비밀번호 일치 검증)

**`src/app/(auth)/layout.tsx`**
- Sidebar 없는 인증 전용 레이아웃
- `bg-gradient-to-br from-indigo-50 via-white to-purple-50` 배경

**`src/app/(auth)/login/page.tsx`**
- 이메일/비밀번호 로그인 (`signInWithPassword`)
- Google OAuth (`signInWithOAuth({ provider: 'google' })`)
- 에러 메시지 통일: 원인 무관 "이메일 또는 비밀번호가 올바르지 않습니다" (이메일 열거 방어)
- `?redirectTo` 성공 후 해당 경로로 이동, 기본값 `/dashboard`

**`src/app/(auth)/signup/page.tsx`**
- 이름(name) + 이메일 + 비밀번호 + 비밀번호 확인 필드
- `signUp({ options: { data: { full_name: name } } })` — `user_metadata.full_name`에 이름 저장
- 이메일 인증 대기 안내 화면 전환

**`src/app/auth/callback/route.ts`**
- Google OAuth `code` → `exchangeCodeForSession` 처리
- Open Redirect 방어: `//` prefix 차단, 기본값 `/dashboard`

**`src/lib/interview/interview-repository.ts`** (수정)
- `findById(id, userId?)` — userId 제공 시 소유권 검증 (`where: { id, userId }`)
- `listCompleted(userId)` — userId 기준 필터링으로 타 사용자 세션 조회 차단

**`prisma/migrations/20260315_rls_interview_sessions/migration.sql`**
- `InterviewSession` 테이블 RLS 활성화
- `users_own_sessions` 정책: `auth.uid()::text = "userId"`

### 수정 파일

**`src/app/(landing)/page.tsx`**
- 상단 nav "로그인" → `<Link href="/login">`
- `StartButton`: `getUser()` 체크 → 인증 시 `/dashboard`, 미인증 시 `/login`
- Hero·하단 CTA 3곳 모두 적용

**`src/components/Sidebar.tsx`**
- `useEffect`로 `getUser()` → 실제 `userEmail`, `userName(full_name)` 표시
- 아바타 이니셜: `userName?.[0] ?? userEmail?.[0] ?? "U"`
- `handleLogout`: `signOut()` → `router.push("/")` → `router.refresh()`

**`src/app/(app)/dashboard/page.tsx`**
- `getUser()` → `user_metadata.full_name ?? email.split("@")[0]` 표시
- 인사 heading: `안녕하세요, {userName}님`

**API Routes — 인증 가드 + IDOR 방어 (5개 라우트)**
- `api/interview/start`: `getUser()` → userId DB 저장, 미인증 시 401
- `api/interview/answer`: 401 가드 + 세션 소유권 403 검증
- `api/interview/followup`: 동일
- `api/interview/[sessionId]/complete`: 동일
- `api/report/generate`: 동일
- `api/growth/sessions`: `getUser()` → userId 기준 필터링, 미인증 시 401
- `api/resumes`: 미인증 시 401

### 테스트 추가

- `tests/unit/middleware.test.ts`: 보호 경로 미인증→리다이렉트, 인증→통과, `//`외부URL 차단
- `tests/ui/login.test.tsx`: 빈 폼 에러, 통일 에러 메시지, signInWithPassword 호출 확인
- `tests/ui/signup.test.tsx`: 비밀번호 정책 Zod 에러, 불일치 에러, signUp 호출 확인
- `tests/api/*`: 5개 API Route 인증 가드 테스트 추가

### 기술적 결정

1. **RLS vs 리포지토리 레벨 userId 필터링**: Prisma는 `auth.uid()` 컨텍스트 없이 직접 DB 연결하므로 RLS만으로는 데이터 격리 불완전. 리포지토리 레벨에서 `userId` 필터를 primary 접근 제어로 적용, RLS는 추가 방어층으로 유지.
2. **이름 저장 위치**: 별도 테이블/컬럼 없이 Supabase `user_metadata.full_name` 활용 — 스키마 변경 불필요.
3. **에러 메시지 통일**: Supabase 에러 코드에 무관하게 동일 메시지 반환 — 이메일 존재 여부 노출 방지.

