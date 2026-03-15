# [#88] feat: Supabase Auth 연동 — 회원가입·로그인·보호 라우트·미들웨어 (siw) — 구현 계획

> 작성: 2026-03-15

---

## 완료 기준

- [x] `middleware.ts` — `@supabase/ssr` createServerClient로 세션 갱신, 미인증 시 `/login` 리다이렉트 (보호 경로: `/dashboard`, `/resumes`, `/interview/*`, `/growth`)
- [x] `src/lib/supabase/server.ts` 개편 — SSR용 `createServerClient` 함수 추가 (기존 service client는 유지)
- [x] 로그인 페이지 `/login` — 이메일/비밀번호 + Google OAuth 실제 구현, glassmorphism 디자인
- [x] 회원가입 페이지 `/signup` — 이메일/비밀번호 입력, 완료 후 이메일 확인 안내
- [x] 랜딩 페이지 "시작하기" CTA → 미인증 시 `/login`, 인증 시 `/dashboard`
- [x] Sidebar 로그아웃 버튼 실제 연동 + 유저 이메일 표시
- [x] `InterviewSession` 생성 시 `userId` 실제 저장 (`/api/interview/start` route 업데이트)
- [x] vitest: 미들웨어 리다이렉트 케이스, 로그인·회원가입 폼 유효성 테스트
- [x] 에러 메시지 통일 — "이메일 또는 비밀번호가 올바르지 않습니다" (이메일 열거 공격 방어)
- [x] Open Redirect 방어 — `?redirectTo` 파라미터가 외부 URL일 경우 차단
- [x] 비밀번호 정책 — 최소 8자·영문+숫자 조합 Zod 검증 (클라이언트 + 서버 양쪽)
- [ ] Rate limiting — Supabase Auth 설정에서 로그인 연속 실패 횟수 제한 활성화 (Supabase Dashboard 수동 설정)
- [ ] RLS 완전성 검증 — `InterviewSession` 외 모든 테이블 RLS 활성화 여부 체크
- [x] `NEXT_PUBLIC_` 키 감사 — `createServiceClient`는 서버 전용, 클라이언트 번들 미노출
- [ ] Google OAuth redirect URI — Google Cloud Console에서 허용 URI 최소화 (수동 설정)

---

## 구현 계획

### Step 1 — `src/lib/supabase/server.ts` 개편

**배경**: 기존 파일은 `createServiceClient`(service role)만 있었고, 미들웨어·API Route에서 쿠키 기반 세션을 읽으려면 `@supabase/ssr`의 `createServerClient`가 별도로 필요.

**변경 내용**:
- `createServerClient(cookieStore: ReadonlyRequestCookies)` 추가 — `@supabase/ssr` 기반, 쿠키 읽기/쓰기 지원
- Server Component에서는 쿠키 set이 불가하므로 `setAll` 내부를 try/catch로 무시 (middleware에서 갱신)
- `createServiceClient()` 기존 코드 유지

---

### Step 2 — `src/middleware.ts` 신규 생성

**배경**: 현재 모든 라우트가 인증 없이 접근 가능. 보호 경로 접근 시 미인증 사용자를 `/login`으로 리다이렉트하고, Supabase 세션 쿠키를 갱신해야 함.

**구현 포인트**:
- `getUser()` 호출 필수 — `getSession()`은 서버에서 신뢰할 수 없어 사용 금지 (Supabase 공식 권장)
- 쿠키 set/get 양방향 처리: `request.cookies` 읽기 + `supabaseResponse.cookies` 쓰기
- Open Redirect 방어: `redirectTo` 파라미터가 `/`로 시작하는 내부 경로인 경우에만 허용

**보호 경로 매처**:
```ts
matcher: ["/dashboard/:path*", "/resumes/:path*", "/interview/:path*", "/growth/:path*"]
```

---

### Step 3 — Zod 검증 스키마 (`src/lib/auth/schemas.ts`)

**배경**: 로그인·회원가입 폼 유효성 검사를 클라이언트/서버 공유 스키마로 관리. 비밀번호 정책을 한 곳에서 관리.

**스키마 구성**:
- `passwordSchema`: 8자 이상, 영문+숫자 포함 (`/(?=.*[a-zA-Z])(?=.*[0-9])/`)
- `loginSchema`: email(유효한 형식) + password(min 1)
- `signupSchema`: email + password(passwordSchema) + confirmPassword, `.refine()`으로 일치 검증

**주의**: Zod v4(`^4.3.6`) 사용 중 — 에러 접근 시 `.errors` 아닌 `.issues` 사용

---

### Step 4 — 인증 전용 레이아웃 (`src/app/(auth)/layout.tsx`)

**배경**: 로그인·회원가입 페이지는 `(app)` 레이아웃(Sidebar 포함)이 아닌 별도 레이아웃이 필요.

**디자인**:
- 전체화면 배경: `bg-gradient-to-br from-indigo-50 via-white to-purple-50`
- 상단 MirAI 로고(gradient-text) + "AI 모의면접 코치" 서브텍스트
- 자식 컴포넌트를 화면 중앙 수직 배치

---

### Step 5 — 로그인 페이지 (`src/app/(auth)/login/page.tsx`)

**배경**: 이메일/비밀번호 로그인 + Google OAuth 로그인 UI 구현. 보안 원칙상 에러 메시지는 원인을 구분하지 않음.

**기능**:
- 이메일/비밀번호 폼 → `supabase.auth.signInWithPassword()`
- 비밀번호 표시/숨김 토글 (Eye/EyeOff 아이콘)
- Google OAuth 버튼 → `supabase.auth.signInWithOAuth({ provider: 'google' })`
- 로그인 실패 시 통일된 에러 메시지: `"이메일 또는 비밀번호가 올바르지 않습니다"` (원인 노출 금지)
- `?redirectTo` 파라미터 읽어서 로그인 성공 후 해당 경로로 이동 (내부 경로만 허용)
- `?error=oauth` 파라미터로 OAuth 실패 에러 표시
- 로딩 중 버튼 `disabled` + SVG 스피너

**디자인 토큰** (기존 codebase 일치):
- 카드: `bg-white/80 backdrop-blur-xl border border-white/60 shadow-2xl rounded-2xl p-8`
- 입력: `border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-violet-500 bg-white/70`
- 주 버튼: `linear-gradient(135deg, #4F46E5, #7C3AED)`
- 에러 박스: `bg-red-50 border border-red-200 text-red-700 rounded-xl`

---

### Step 6 — 회원가입 페이지 (`src/app/(auth)/signup/page.tsx`)

**배경**: Google OAuth는 로그인 페이지에서만 지원. 회원가입은 이메일/비밀번호만.

**기능**:
- 이메일 + 비밀번호 + 비밀번호 확인 폼
- Zod `signupSchema`로 클라이언트 검증 (8자, 영문+숫자, 일치 여부)
- 비밀번호 규칙 힌트: "ⓘ 8자 이상, 영문 + 숫자 포함"
- `supabase.auth.signUp()` 호출 — 이메일 확인 설정에 따라 확인 메일 발송
- 성공 시: success state로 전환 → "이메일을 확인해주세요" 안내 화면
- Supabase 에러 시: "회원가입 중 오류가 발생했습니다. 다시 시도해주세요."

---

### Step 7 — Google OAuth 콜백 라우트 (`src/app/auth/callback/route.ts`)

**배경**: `signInWithOAuth` 완료 후 Supabase가 이 엔드포인트로 `?code`와 함께 리다이렉트함.

**처리 흐름**:
1. `?code` 파라미터 수신
2. `supabase.auth.exchangeCodeForSession(code)` 호출
3. 에러 시 `/login?error=oauth` 리다이렉트
4. 성공 시 `?next` 파라미터 경로로 이동 (없으면 `/dashboard`)
5. Open Redirect 방어: `next`가 `/`로 시작하지 않으면 `/dashboard` 강제

---

### Step 8 — 랜딩 페이지 CTA 수정 (`src/app/(landing)/page.tsx`)

**배경**: "시작하기" 버튼이 `/dashboard`로 하드코딩되어 있어 미인증 사용자도 바로 앱으로 진입 가능. 미들웨어가 막아주지만 UX상 로그인 페이지로 보내는 게 맞음.

**변경 내용**:
- NAV 우측 "로그인" `<span>` → `<Link href="/login">` 으로 변경
- "시작하기" 버튼 3곳(Nav·Hero·Bottom CTA) 모두 `StartButton` 컴포넌트로 교체
- `StartButton`: `createSupabaseBrowser().auth.getUser()` 체크 → 로그인 시 `/dashboard`, 미인증 시 `/login`

---

### Step 9 — Sidebar 실제 유저 정보 + 로그아웃 연동 (`src/components/Sidebar.tsx`)

**배경**: 하드코딩된 "사용자" / "user@example.com" 표시 및 동작하지 않는 로그아웃 버튼.

**변경 내용**:
- `useEffect`로 `createSupabaseBrowser().auth.getUser()` 호출 → `userEmail` state 저장
- 이니셜 아바타: `userEmail?.[0].toUpperCase() ?? "U"`
- 이메일 표시: `userEmail ?? "로딩 중..."`
- 로그아웃 `onClick`: `supabase.auth.signOut()` → `router.push("/")` → `router.refresh()`
- 기존 "사용자" 이름 라벨 제거 (이메일만 표시)

---

### Step 10 — Interview Start Route userId 저장

**배경**: `InterviewSession.userId` 필드가 존재하나 항상 `null`. 인증 연동 후 실제 저장 필요.

**변경 내용**:
- `route.ts`: `cookies()` + `createServerClient()` → `supabase.auth.getUser()` → `user?.id` 추출
- `interview-service.ts`: `start(resumeId, personas, userId?: string | null)` 시그니처 추가
- `interview-repository.ts`: `create({ ..., userId?: string | null })` 필드 추가
- 미인증 사용자는 `userId: null`로 저장 (미들웨어가 보호하므로 실제로는 항상 인증됨)

---

### Step 11 — RLS 마이그레이션

**배경**: Prisma로 생성된 테이블은 RLS가 자동 비활성화. 유저별 데이터 격리를 위해 수동 활성화 필요.

**SQL**:
```sql
ALTER TABLE "InterviewSession" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_sessions"
  ON "InterviewSession"
  FOR ALL
  USING (auth.uid()::text = "userId");
```

**주의사항**:
- `userId`가 null인 기존 세션은 이 정책에서 자동 제외 (기존 데이터 마이그레이션 불필요)
- service role(`createServiceClient`)은 RLS 우회 — 서버 측 작업에 영향 없음
- **실제 DB 적용은 수동 필요**: Supabase SQL 에디터 또는 `prisma migrate deploy` 실행

---

### Step 12 — 테스트 작성

#### `tests/unit/middleware.test.ts` (신규)
- `@supabase/ssr` createServerClient 모킹
- 4케이스: 미인증 리다이렉트, redirectTo 파라미터 포함, 인증 통과, Open Redirect 방어

#### `tests/ui/login.test.tsx` (신규)
- `next/navigation`, `@/lib/supabase/browser` 모킹
- 3케이스: 빈 폼 제출 → 호출 없음, 로그인 실패 → 통일 에러, 로그인 성공 → 라우팅

#### `tests/ui/signup.test.tsx` (신규)
- `next/navigation`, `@/lib/supabase/browser` 모킹
- 4케이스: 7자 비밀번호 에러, 숫자 없음 에러, 불일치 에러, 유효 입력 → signUp 호출

#### `tests/api/interview-start-route.test.ts` (기존 수정)
- `next/headers` cookies 모킹 추가
- `@/lib/supabase/server` createServerClient 모킹 추가
- 기존 3케이스(200/400/500) 유지

---

## 트러블슈팅 기록

### Zod v4 `.issues` vs `.errors`
- **문제**: `result.error.errors[0].message` 접근 시 `TypeError: Cannot read properties of undefined`
- **원인**: 프로젝트가 Zod v4(`^4.3.6`) 사용. v4에서 `ZodError.errors` → `ZodError.issues`로 변경됨
- **해결**: `result.error.issues[0].message` 로 수정 (login/page.tsx, signup/page.tsx)

### `interview-start-route.test.ts` cookies 에러
- **문제**: `Error: 'cookies' was called outside a request scope`
- **원인**: Route에 `cookies()` 추가 후 기존 테스트가 Next.js request context 없이 실행
- **해결**: 테스트에 `vi.mock("next/headers", ...)` + `vi.mock("@/lib/supabase/server", ...)` 추가

---

## 작업 결과 요약

### 신규 파일 (7개)
| 파일 | 설명 |
|------|------|
| `src/middleware.ts` | 세션 갱신 + 보호 라우트 리다이렉트 |
| `src/lib/auth/schemas.ts` | Zod v4 loginSchema / signupSchema / passwordSchema |
| `src/app/(auth)/layout.tsx` | 인증 전용 레이아웃 (gradient 배경, Sidebar 없음) |
| `src/app/(auth)/login/page.tsx` | 이메일/비밀번호 + Google OAuth |
| `src/app/(auth)/signup/page.tsx` | 회원가입 + 이메일 확인 안내 |
| `src/app/auth/callback/route.ts` | OAuth 코드 교환 |
| `prisma/migrations/20260315000000_rls_interview_sessions/migration.sql` | InterviewSession RLS 활성화 |

### 수정 파일 (6개)
| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/supabase/server.ts` | SSR `createServerClient` 추가 |
| `src/app/(landing)/page.tsx` | 로그인 Link + auth 체크 StartButton |
| `src/components/Sidebar.tsx` | 실제 userEmail 표시 + 로그아웃 연동 |
| `src/app/api/interview/start/route.ts` | `getUser()` → userId 저장 |
| `src/lib/interview/interview-service.ts` | `start()` userId 파라미터 추가 |
| `src/lib/interview/interview-repository.ts` | `create()` userId 필드 추가 |

### 테스트
| 파일 | 상태 | 케이스 수 |
|------|------|-----------|
| `tests/unit/middleware.test.ts` | 신규 | 4 |
| `tests/ui/login.test.tsx` | 신규 | 3 |
| `tests/ui/signup.test.tsx` | 신규 | 4 |
| `tests/api/interview-start-route.test.ts` | 수정 | 3 (기존 유지) |

**전체 테스트**: 21 test files, 90 tests passed ✅

---

## 수동 설정 필요 항목 (코드 외)

- [ ] **Supabase Dashboard**: Auth → Providers → Google → Client ID/Secret 입력
- [ ] **Google Cloud Console**: OAuth 클라이언트 생성 + `{SUPABASE_URL}/auth/v1/callback` redirect URI 등록
- [ ] **Rate limiting**: Supabase Dashboard → Auth → Rate Limits 설정
- [ ] **RLS SQL 실제 적용**: `prisma/migrations/20260315000000_rls_interview_sessions/migration.sql` 실행
- [ ] **환경변수**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정 확인

---

## 추가 작업 (브라우저 테스트 후 피드백 반영)

### 이름 필드 추가
- `lib/auth/schemas.ts` — signupSchema에 name 필드 추가
- `(auth)/signup/page.tsx` — 이름 입력 필드 추가 (User 아이콘), signUp options에 full_name 저장
- `components/Sidebar.tsx` — user_metadata.full_name 표시, 아바타 이니셜 이름 우선
- `(app)/dashboard/page.tsx` — "안녕하세요, {이름}님" 실제 이름 표시

### 애니메이션 속도 조정
- 로그인 카드: 0.5s → 0.7s
- 회원가입 패널: 0.6s → 0.8s, 카드: 0.5s 0.1s → 0.7s 0.15s

### 보안 패치 (Code Review P0/P1/P2)
- [P0-1] answer/followup/complete/report API에 auth guard + ownership 체크 추가
- [P0-2] interview/start route 미인증 시 401 리턴
- [P0-3] 미들웨어/login 페이지 Open Redirect `//` 차단
- [P1-1] resumes API userId 필터 추가
- [P1-2] auth/callback code 없을 때 /login?error=oauth 리다이렉트
- [P2-1] growth/sessions 미인증 시 401 리턴
- [P2-2] Open Redirect protocol-relative URL 차단
