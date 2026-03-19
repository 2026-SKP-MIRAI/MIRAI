# [#151] feat: [seung] Supabase Auth 연동 — 회원가입·로그인·보호 라우트 — 구현 계획

> 작성: 2026-03-19

---

## 완료 기준

- [ ] `@supabase/ssr`, `@supabase/supabase-js` 설치 + `src/lib/supabase/browser.ts`, `server.ts` 신규 생성
- [ ] `middleware.ts` 신규 생성 — 세션 갱신 + 미인증 시 `/login` 리다이렉트 (보호 경로: `/resume`, `/interview`, `/report`, `/diagnosis`)
- [ ] `/login`, `/signup` 페이지 구현 (이메일/비밀번호), 로그아웃 버튼 (`layout.tsx`)
- [ ] `Resume`, `InterviewSession`, `Report` 테이블에 `userId` 컬럼 추가 + Prisma 마이그레이션
- [ ] `/api/resume/questions`, `/api/interview/start`에서 인증된 userId 저장
- [ ] `/api/interview/session`, `/api/interview/answer`, `/api/resume/diagnosis`에서 소유권 검증 (타인 세션 접근 차단)
- [ ] RLS SQL 마이그레이션 (`resumes`, `interview_sessions`, `reports` 테이블)
- [ ] `next build` 통과, Vitest 회귀 없음

---

## 구현 계획

### 전체 요약

| Step | 내용 | 주요 파일 |
|------|------|-----------|
| 0 | 선행조건 확인 — `.env.local`에 Supabase 환경변수 추가 | `.env.local` |
| 1 | 패키지 설치 + Supabase 클라이언트 헬퍼 생성 | `src/lib/supabase/browser.ts`, `server.ts` |
| 2 | `middleware.ts` 생성 — 세션 갱신 + 보호 라우트 리다이렉트 | `src/middleware.ts` |
| 3 | `/login`, `/signup` 페이지 + 로그아웃 버튼 + OAuth 콜백 라우트 | `app/login/`, `app/signup/`, `app/auth/callback/`, `app/layout.tsx` |
| 4 | Prisma 스키마 `userId` 컬럼 추가 + 마이그레이션 + RLS SQL | `prisma/schema.prisma`, `supabase/migrations/add_rls.sql` |
| 5 | API 라우트 전체 인증·소유권 검증 추가 (401/403) | 7개 API 라우트 |
| 6 | 기존 테스트 수정 (supabase mock 추가) + 신규 테스트 추가 (401/403 케이스) | `tests/api/` 7개 파일 + 신규 1개 |

---

### Step 0 — 선행조건 확인 ✅

- [x] `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 추가 완료
- Supabase project ref: `rwocoqfqhgzleukzopyt` (DATABASE_URL과 동일 프로젝트 확인)

---

### Step 1 — 패키지 설치 + Supabase 클라이언트 헬퍼 생성

**파일 변경:**
- `services/seung/package.json` — `@supabase/ssr`, `@supabase/supabase-js` 추가
- `services/seung/src/lib/supabase/browser.ts` — 신규 생성
- `services/seung/src/lib/supabase/server.ts` — 신규 생성

**구현 세부:**

`browser.ts` (Client Component 전용):
```ts
import { createBrowserClient } from '@supabase/ssr'
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

`server.ts` (Route Handler / Server Component 전용):
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  // Next.js 16에서 cookies()는 Promise를 반환 — 반드시 await
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

> `SUPABASE_SERVICE_ROLE_KEY`는 절대 `NEXT_PUBLIC_` prefix로 노출 금지 (아키텍처 불변식 §1)

---

### Step 2 — `middleware.ts` 신규 생성

**파일 변경:**
- `services/seung/src/middleware.ts` — 신규 생성

**구현 세부:**

미들웨어는 `next/headers`의 `cookies()`를 **사용하지 않는다.** Request/Response 객체에서 직접 쿠키를 읽고 쓰는 별도 패턴을 사용한다.

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 세션 갱신 (토큰 만료 시 자동 갱신)
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isProtectedPage =
    pathname.startsWith('/resume') ||
    pathname.startsWith('/interview') ||
    pathname.startsWith('/report') ||
    pathname.startsWith('/diagnosis')

  // API 라우트는 리다이렉트 없이 세션만 갱신 (각 handler에서 401 반환)
  if (!user && isProtectedPage) {
    const redirectTo = request.nextUrl.pathname
    // 오픈 리다이렉트 차단: redirectTo는 pathname만 허용
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectTo', redirectTo)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // 정적 파일만 제외, API 포함 (세션 갱신 목적)
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
```

---

### Step 3 — `/login`, `/signup` 페이지 + 로그아웃 버튼

**파일 변경:**
- `services/seung/src/app/login/page.tsx` — 신규 생성
- `services/seung/src/app/signup/page.tsx` — 신규 생성
- `services/seung/src/app/layout.tsx` — 로그아웃 버튼 추가
- `services/seung/src/app/auth/callback/route.ts` — 신규 생성

**구현 세부:**
- `login/page.tsx`: `'use client'` — 이메일/비밀번호 form → `supabase.auth.signInWithPassword()` → 성공 시 `?redirectTo` 파라미터 위치 또는 `/resume`으로 `router.push` (외부 URL 차단)
- `signup/page.tsx`: `'use client'` — `supabase.auth.signUp()` → 성공 시 "이메일을 확인해 주세요" 안내
- `layout.tsx`: `async` Server Component — `createClient()` + `getUser()` → 로그인 시 로그아웃 버튼 렌더 (Server Action으로 `supabase.auth.signOut()` 호출)
- `auth/callback/route.ts`: `code` 파라미터 받아 `supabase.auth.exchangeCodeForSession(code)` 처리

---

### Step 4 — Prisma 스키마 `userId` 추가 + 마이그레이션

**파일 변경:**
- `services/seung/prisma/schema.prisma`
- 신규 마이그레이션 파일 (`prisma migrate dev --name add_user_id`)
- `services/seung/supabase/migrations/add_rls.sql` — 신규 생성

**스키마 변경:**
```prisma
model Resume {
  userId  String?   // Supabase auth.users.id (nullable — 기존 데이터 호환)
  ...
}
model InterviewSession {
  userId  String?
  ...
}
model Report {
  userId  String?
  ...
}
```
- `nullable String?` — 기존 데이터 무중단 호환

**RLS SQL:**
```sql
ALTER TABLE "Resume" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON "Resume" USING (auth.uid()::text = "userId");

ALTER TABLE "InterviewSession" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON "InterviewSession" USING (auth.uid()::text = "userId");

ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON "Report" USING (auth.uid()::text = "userId");
```
> RLS는 Supabase 콘솔 또는 DIRECT_URL로 직접 적용. Prisma는 pooler(postgres user)를 통해 연결하므로 RLS 적용 여부는 DB role 설정에 따름. RLS는 직접 DB 접근 차단을 위한 추가 방어선이며, 주된 소유권 검증은 API 레이어에서 수행.

---

### Step 5 — API 라우트 업데이트

모든 라우트에서 `createClient()` 호출 → `supabase.auth.getUser()` → 미인증 시 즉시 401 반환.

#### 5-A. userId 저장 라우트

**`/api/resume/questions` (POST)**
- `getUser()` → 미인증 401
- `prisma.resume.create({ data: { resumeText, questions: [], userId: user.id } })`

**`/api/interview/start` (POST)**
- `getUser()` → 미인증 401
- resume 조회: `where: { id: resumeId, userId: user.id }` → null이면 404 (타인 resume 접근 차단)
- `prisma.interviewSession.create({ data: { ..., userId: user.id } })`

#### 5-B. 소유권 검증 라우트

**`/api/interview/session` (GET)**
- `getUser()` → 미인증 401
- select에 `userId: true` 추가 (현재 누락):
  ```ts
  select: { currentQuestion, ..., interviewMode, userId: true }
  ```
- `session.userId !== user.id` → 403

**`/api/interview/answer` (POST)**
- `getUser()` → 미인증 401
- `findUnique` 결과에 `userId` 포함 (select 없으므로 자동 포함)
- `session.userId !== user.id` → 403

**`/api/resume/diagnosis` (GET)**
- `getUser()` → 미인증 401
- select에 `userId: true` 추가:
  ```ts
  select: { id: true, diagnosisResult: true, userId: true }
  ```
- `resume.userId !== user.id` → 403

**`/api/resume/feedback` (POST)**
- `getUser()` → 미인증 401 (파일 내 TODO 주석 이미 있음)
- `findUnique` 후 `resume.userId !== user.id` → 403

**`/api/report/route.ts` (GET)**
- `getUser()` → 미인증 401
- `report.findUnique({ where: { id: reportId } })` 후 `report.userId !== user.id` → 403
  (Report 모델에 userId 직접 추가하므로 join 불필요)

**`/api/report/generate/route.ts` (POST)**
- `getUser()` → 미인증 401
- session 조회 (include resume — select 없음, userId 자동 포함)
- `session.userId !== user.id` → 403
- report 생성 시 userId 저장:
  ```ts
  prisma.report.create({ data: { sessionId, totalScore, scores, summary, axisFeedbacks, userId: user.id } })
  ```

**`/api/practice/feedback` (POST)** — **인증 추가 안 함**
- DB 조회 없음, 순수 엔진 호출
- AC에 명시 없음 → 미인증 사용자도 연습 기능 사용 가능하게 유지

> **소유권 검증 패턴**: `userId === null` (기존 데이터) → `null !== user.id` → 403. 레거시 데이터 접근 차단.

---

### Step 6 — 기존 테스트 수정 + 신규 테스트 추가

#### 6-A. 기존 테스트 수정 대상 파일

인증이 추가되는 라우트의 테스트만 수정 (`practice-feedback.test.ts`는 인증 추가 안 하므로 제외):

| 파일 | 수정 내용 |
|------|-----------|
| `interview-answer.test.ts` | supabase mock 추가, `mockSession`에 `userId: 'user-1'` |
| `interview-start.test.ts` | supabase mock 추가, `mockPrisma.resume.findUnique` mock에 `userId` 반영 |
| `questions.test.ts` | supabase mock 추가, `toHaveBeenCalledWith`에 `userId: 'user-1'` 포함 (line 169–175) |
| `report-generate.test.ts` | supabase mock 추가, `mockSession`에 `userId: 'user-1'` |
| `report-get.test.ts` | supabase mock 추가, `mockReport`에 `userId: 'user-1'` |
| `resume-diagnosis.test.ts` | supabase mock 추가 |
| `resume-feedback.test.ts` | supabase mock 추가 |

`practice-feedback.test.ts` — 수정 불필요 (인증 미추가)

**공통 mock 패턴** (각 파일 상단에 추가):
```ts
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
  }),
}))
```

**`questions.test.ts` line 169–175 특이 케이스:**
```ts
// 변경 전
expect(mockPrisma.resume.create).toHaveBeenCalledWith({
  data: { resumeText: 'extracted text', questions: [] },
})
// 변경 후
expect(mockPrisma.resume.create).toHaveBeenCalledWith({
  data: { resumeText: 'extracted text', questions: [], userId: 'user-1' },
})
```

#### 6-B. 신규 테스트 추가 (`tests/api/`)

신규 파일: `tests/api/interview-session.test.ts`

신규 케이스 (기존 파일에 추가):
- `interview-answer.test.ts`: 미인증 → 401, 타인 세션 → 403
- `interview-start.test.ts`: 미인증 → 401, 타인 resume → 404
- `resume-diagnosis.test.ts`: 미인증 → 401, 타인 resume → 403
- `resume-feedback.test.ts`: 미인증 → 401, 타인 resume → 403
- `report-get.test.ts`: 미인증 → 401, 타인 report → 403
- `report-generate.test.ts`: 미인증 → 401, 타인 session → 403
- `interview-session.test.ts` (신규): 정상 200, 미인증 401, 타인 403

---

## 구현 순서 및 의존성

```
Step 0 (선행조건 ✅)
  ↓
Step 1 (패키지 + supabase 클라이언트 헬퍼)
  ├── Step 2 (middleware.ts)
  ├── Step 3 (login/signup 페이지 + layout)
  └── Step 4 (Prisma 마이그레이션) ← Step 1과 병렬 가능
              ↓
         Step 5 (API 라우트 업데이트)
              ↓
         Step 6-A (기존 테스트 수정)
         Step 6-B (신규 테스트 추가)
```

---

## 주의사항 · 엣지 케이스

| 항목 | 처리 |
|------|------|
| `SUPABASE_SERVICE_ROLE_KEY` 클라이언트 노출 | `NEXT_PUBLIC_` prefix 금지, server-only에서만 사용 |
| Next.js 16 `cookies()` async | `server.ts`에서 `await cookies()` 필수. middleware에서는 `request.cookies` / `response.cookies` 사용 (next/headers 사용 안 함) |
| API 라우트와 middleware | matcher에 API 포함 (세션 갱신 목적). 리다이렉트는 보호 페이지 라우트에만. API는 각 handler에서 401 반환 |
| 기존 데이터 (`userId=null`) | nullable 마이그레이션으로 무중단. 소유권 검증에서 403 처리 |
| RLS vs API 레이어 | 주된 검증은 API 레이어. RLS는 직접 DB 접근 차단용 추가 방어선 |
| 오픈 리다이렉트 | `redirectTo`는 pathname만 허용. login page에서 외부 URL 차단 |
| `practice/feedback` 인증 | 미추가 (DB 없음, AC에 없음, 연습 기능은 비로그인 사용 허용) |
| mock 함수명 일관성 | `server.ts`의 export 함수명 `createClient`로 고정 — 테스트 mock과 일치 |
