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

- [ ] `middleware.ts` — `@supabase/ssr` createServerClient로 세션 갱신, 미인증 시 `/login` 리다이렉트 (보호 경로: `/dashboard`, `/resumes`, `/interview/*`, `/growth`)
- [ ] `src/lib/supabase/server.ts` 개편 — SSR용 `createServerClient` 함수 추가 (기존 service client는 유지)
- [ ] 로그인 페이지 `/login` — 이메일/비밀번호 + Google OAuth 실제 구현 (`supabase.auth.signInWithOAuth({ provider: 'google' })`), glassmorphism 디자인
- [ ] 회원가입 페이지 `/signup` — 이메일/비밀번호 입력, 완료 후 `/dashboard` 이동
- [ ] 랜딩 페이지 "시작하기" CTA → 미인증 시 `/login`, 인증 시 `/dashboard`
- [ ] 앱 내부 레이아웃(`(app)/layout.tsx`)에 로그아웃 버튼 (Sidebar 하단 또는 헤더)
- [ ] `InterviewSession` 생성 시 `userId` 실제 저장 (`/api/interview/start` route 업데이트)
- [ ] vitest: 미들웨어 리다이렉트 케이스, 로그인·회원가입 폼 유효성 테스트

### 보안 강화 항목
- [ ] 에러 메시지 통일 — "이메일 또는 비밀번호가 올바르지 않습니다" (이메일 열거 공격 방어)
- [ ] Open Redirect 방어 — `?redirectTo` 파라미터가 외부 URL일 경우 차단 (`/` 시작 여부 검증)
- [ ] 비밀번호 정책 — 최소 8자·영문+숫자 조합 Zod 검증 (클라이언트 + 서버 양쪽)
- [ ] Rate limiting — Supabase Auth 설정에서 로그인 연속 실패 횟수 제한 활성화
- [ ] RLS 완전성 검증 — `interview_sessions` 외 모든 테이블 RLS 활성화 여부 체크 (resumes 포함)
- [ ] `NEXT_PUBLIC_` 키 감사 — 빌드 번들에 `SUPABASE_SERVICE_ROLE_KEY` 미포함 확인
- [ ] Google OAuth redirect URI — Google Cloud Console에서 허용 URI 최소화 (프로덕션 도메인만)

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

