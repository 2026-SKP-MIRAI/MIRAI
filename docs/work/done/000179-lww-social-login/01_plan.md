# [#179] feat: [lww] Phase 1 — 소셜 로그인 (카카오·구글) 구현 — 구현 계획

> 작성: 2026-03-21 | 아키텍처: Architect(Opus) + Critic(Opus) 검토 완료

---

## 완료 기준

- [ ] 카카오·구글 OAuth 로그인/로그아웃 작동 (콜백 처리 포함)
- [ ] 이메일 가입/로그인 작동 (이메일 확인 링크 포함)
- [ ] 로그인 후 면접 세션이 해당 사용자 계정(`auth.uid()`)에 연결 저장
- [ ] 비로그인 상태로 면접 완료 시 "저장하려면 로그인" CTA 표시
- [ ] `middleware.ts`에서 Supabase 세션 자동 갱신 처리 (`getUser()`)
- [ ] 히스토리 탭(`/interview`)에서 내 면접 세션 목록 표시
- [ ] `profiles` 테이블 + RLS 마이그레이션 완료
- [ ] 테스트 코드 포함
- [ ] `services/lww/.ai.md` 최신화
- [ ] 불변식 위반 없음 (인증은 서비스에서만, 엔진은 무관)

---

## 아키텍처 핵심 결정

### LWW 고유 원칙 (SIW/Seung과 다른 점)

| 항목 | SIW/Seung | LWW |
|------|-----------|-----|
| 기본 상태 | 로그인 필수 | **익명 우선** |
| 미들웨어 리다이렉트 | 비로그인 → `/login` 강제 | **절대 리다이렉트 금지** |
| 세션 추적 | user_id만 | **anon_id + user_id 병행** |
| 콜백 역할 | 로그인 후 대시보드 이동 | **로그인 + 익명 세션 마이그레이션** |

### 핵심 결정사항

1. **콜백 경로**: `services/lww/src/app/auth/callback/route.ts` (NOT `/api/auth/callback`)
   - `/api/` 아래는 REST 데이터 엔드포인트. OAuth 콜백은 브라우저 리다이렉트 대상 → `app/auth/callback/`
2. **익명→인증 마이그레이션**: 서버 사이드 콜백에서 Supabase RPC 함수로 원자적 처리
3. **anon_id 쿠키**: 로그인 후에도 유지 (삭제 안 함) — 로그아웃 후 익명 연속성 보장
4. **미들웨어**: rate limiter 먼저 → `getUser()` 세션 갱신 (리다이렉트 없음)
5. **API 라우트 dual-write**: `createClient()` + `getUser()` 추가, 로그인 상태면 `user_id`도 저장
6. **히스토리 탭**: Server Component, 인증 상태에 따라 쿼리 분기

---

## 구현 계획

### Step 0: DB 마이그레이션 (Supabase SQL Editor — 수동 실행)

**파일**: Supabase Dashboard → SQL Editor

```sql
-- 1. profiles 테이블 (dev_spec.md:478-523 기준)
create table if not exists profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz default now()
);
alter table profiles enable row level security;
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- 2. auth.users 생성 시 profiles 자동 삽입 트리거
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- 3. 익명→인증 마이그레이션 RPC 함수 (원자적 트랜잭션 보장)
create or replace function migrate_anon_to_user(p_anon_id text, p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  update interview_sessions
    set user_id = p_user_id
    where anonymous_id = p_anon_id and user_id is null;
  update reports
    set user_id = p_user_id
    where anonymous_id = p_anon_id and user_id is null;
end;
$$;
```

**주의**: `interview_sessions`과 `reports` 테이블에 이미 `user_id uuid` 컬럼이 존재하는지 확인 (dev_spec.md:412, 448). 없으면 `ALTER TABLE ... ADD COLUMN user_id uuid references auth.users(id)` 먼저 실행.

---

### Step 1: Supabase Dashboard OAuth Provider 활성화 (수동)

1. Supabase Dashboard → Authentication → Providers
2. **Google**: Client ID/Secret 입력
   - Redirect URL: `{NEXT_PUBLIC_SITE_URL}/auth/callback`
3. **Kakao**: Client ID/Secret 입력
   - Redirect URL: `{NEXT_PUBLIC_SITE_URL}/auth/callback`
4. 환경변수 확인: `NEXT_PUBLIC_SITE_URL` (`.env.local`)

---

### Step 2: middleware.ts 업데이트

**파일**: `services/lww/src/middleware.ts`

**변경 내용**:
- 기존 rate limiter 로직 유지 (순서 변경 없음)
- rate limit 통과 후 Supabase 세션 갱신 추가
- **절대 익명 사용자 리다이렉트 금지**
- matcher 전체 경로로 확장 (static 제외)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// rate limiter (기존 코드 유지)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10;
const WINDOW_MS = 60 * 1000;

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Rate limit (API routes only)
  if (pathname.startsWith("/api/interview/") || pathname.startsWith("/api/resume/")) {
    const ip = getClientIP(request);
    const now = Date.now();
    const key = `${ip}:${pathname.split("/").slice(0, 4).join("/")}`;
    const current = rateLimitMap.get(key);
    if (!current || now > current.resetTime) {
      rateLimitMap.set(key, { count: 1, resetTime: now + WINDOW_MS });
    } else if (current.count >= RATE_LIMIT) {
      return NextResponse.json(
        { message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((current.resetTime - Date.now()) / 1000)) } }
      );
    } else {
      current.count++;
    }
  }

  // 2. Supabase 세션 갱신 (전체 경로)
  // LWW는 익명 우선: user가 없어도 절대 리다이렉트하지 않는다
  let supabaseResponse = NextResponse.next({ request });
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );
    await supabase.auth.getUser(); // 세션 갱신 목적만 (결과 무시)
  } catch {
    // auth 인프라 장애 시에도 익명 기능은 정상 동작해야 함
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

---

### Step 3: `/auth/callback` Route Handler 생성

**파일**: `services/lww/src/app/auth/callback/route.ts` (새 파일)

**역할**:
1. OAuth code → session 교환
2. 기존 익명 세션을 인증 사용자에 원자적 연결 (RPC)
3. `next` 파라미터로 안전한 리다이렉트

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Open Redirect 방어
  const safeRedirect = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  // 익명 세션 마이그레이션 (RPC — 원자적 트랜잭션)
  const cookieStore = await cookies();
  const anonId = cookieStore.get("lww_anon_id")?.value;
  if (anonId) {
    const serviceClient = createServiceClient();
    const { error: migrateError } = await serviceClient.rpc("migrate_anon_to_user", {
      p_anon_id: anonId,
      p_user_id: data.user.id,
    });
    if (migrateError) {
      // 마이그레이션 실패는 치명적 오류가 아님 — 로그만 기록
      console.error("[auth/callback] 세션 마이그레이션 실패:", migrateError);
    }
  }

  return NextResponse.redirect(`${origin}${safeRedirect}`);
}
```

**엣지케이스**:
- `anonId` 없음 (새 기기, 쿠키 삭제): 마이그레이션 스킵 — 정상 동작
- 이미 다른 계정에 연결된 세션: RPC 내 `user_id IS NULL` 조건으로 재연결 방지
- 마이그레이션 실패: 로그인은 성공, 세션은 익명으로 남음 (허용된 결과)

---

### Step 4: `/login` 페이지 생성

**파일**: `services/lww/src/app/(main)/login/page.tsx` (새 파일)

**역할**: 카카오·구글 OAuth + 이메일 가입/로그인, 에러 표시

**이메일 인증 흐름**:
- 가입(`signUp`): 확인 이메일 발송 → 사용자가 링크 클릭 → `/auth/confirm` 라우트 처리
- 로그인(`signInWithPassword`): 즉시 세션 발급 (콜백 불필요)
- 탭/토글로 "소셜 로그인 | 이메일" 전환

```typescript
"use client";

import { createClient } from "@/lib/supabase/browser";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";

function LoginContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const hasError = searchParams.get("error") === "oauth";

  const [tab, setTab] = useState<"social" | "email">("social");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const handleKakao = () =>
    supabase.auth.signInWithOAuth({ provider: "kakao", options: { redirectTo } });
  const handleGoogle = () =>
    supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setMessage(error.message); return; }
      router.push(next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) { setMessage(error.message); return; }
      setMessage("확인 이메일을 발송했습니다. 받은편지함을 확인해주세요.");
    }
  };

  return (
    <div>
      {hasError && <p>로그인 중 오류가 발생했습니다. 다시 시도해주세요.</p>}
      {/* 탭 전환 */}
      <div>
        <button onClick={() => setTab("social")}>소셜 로그인</button>
        <button onClick={() => setTab("email")}>이메일</button>
      </div>
      {tab === "social" ? (
        <>
          <button onClick={handleKakao}>카카오로 계속하기</button>
          <button onClick={handleGoogle}>구글로 계속하기</button>
        </>
      ) : (
        <form onSubmit={handleEmailSubmit}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="이메일" required />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="비밀번호" required />
          {message && <p>{message}</p>}
          <button type="submit">{mode === "signin" ? "로그인" : "가입하기"}</button>
          <button type="button" onClick={() => setMode(m => m === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "계정이 없으신가요? 가입하기" : "이미 계정이 있으신가요? 로그인"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
```

**로그아웃**: 클라이언트 `supabase.auth.signOut()` 후 홈 이동.

---

### Step 4.5: `/auth/confirm` Route Handler 생성 (이메일 확인용)

**파일**: `services/lww/src/app/auth/confirm/route.ts` (새 파일)

**역할**: 이메일 가입 확인 링크 처리 (`token_hash` + `type` 파라미터)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  const safeRedirect = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!token_hash || !type) {
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash, type });

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  return NextResponse.redirect(`${origin}${safeRedirect}`);
}
```

**흐름**: 사용자 이메일 클릭 → `/auth/confirm?token_hash=...&type=signup&next=/` → `verifyOtp()` → 세션 발급 → `safeRedirect`

---

### Step 5: interview API 라우트 dual-write

**대상 파일**:
- `services/lww/src/app/api/interview/start/route.ts`
- `services/lww/src/app/api/interview/answer/route.ts`
- `services/lww/src/app/api/interview/end/route.ts`

**패턴** (각 라우트 공통):

```typescript
// 기존 createServiceClient() 유지
// 추가: 로그인 상태 감지
import { createClient } from "@/lib/supabase/server";

// POST 핸들러 내부에서:
const userClient = await createClient();
const { data: { user } } = await userClient.auth.getUser();
const userId = user?.id ?? null; // 비로그인이면 null

// DB insert/update 시:
await supabase.from("interview_sessions").insert({
  // ... 기존 필드들 ...
  anonymous_id: anonymousId,
  user_id: userId,  // 로그인이면 auth.uid(), 비로그인이면 null
});
```

**주의**: `createClient()`와 `createServiceClient()` 동시 사용. `getUser()`는 인증 상태 확인 전용, 실제 DB 쓰기는 service client로.

---

### Step 6: "저장하려면 로그인" CTA 컴포넌트

**파일**: `services/lww/src/components/interview/SaveAccountCTA.tsx` (새 파일)

**조건**: 면접 완료 UI에서 비로그인 상태일 때 표시

```typescript
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import Link from "next/link";

interface SaveAccountCTAProps {
  sessionId: string;
}

export function SaveAccountCTA({ sessionId }: SaveAccountCTAProps) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });
  }, []);

  if (isLoggedIn !== false) return null; // 로그인 상태 또는 로딩 중

  return (
    <div>
      <p>면접 결과를 영구 저장하려면 로그인하세요</p>
      <Link href={`/login?next=/report/${sessionId}`}>
        로그인 / 가입하기
      </Link>
    </div>
  );
}
```

**연결 위치**: 리포트 페이지 또는 면접 완료 UI 컴포넌트에 `<SaveAccountCTA sessionId={sessionId} />` 추가.

---

### Step 7: 히스토리 탭 Server Component 전환

**파일**: `services/lww/src/app/(main)/interview/page.tsx`

**DB → UI 데이터 매핑**:

| DB 컬럼 (interview_sessions) | UI `InterviewRecord` 필드 | 변환 |
|-------------------------------|---------------------------|------|
| `id` | `id` | 직접 사용 |
| `created_at` | `date` | `new Date(created_at).toLocaleDateString('ko-KR')` |
| `job_category` (쉼표 구분 문자열) | `jobCategories: string[]` | `.split(", ")` |
| `reports[0].total_score` | `score` | JOIN 후 추출 |

**구현 패턴**:

```typescript
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export default async function InterviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let sessions = [];
  if (user) {
    // 로그인: user_id 기준 쿼리
    const { data } = await supabase
      .from("interview_sessions")
      .select("id, created_at, job_category, reports(total_score)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    sessions = data ?? [];
  } else {
    // 비로그인: anon_id 기준 (service client, RLS 우회)
    const cookieStore = await cookies();
    const anonId = cookieStore.get("lww_anon_id")?.value;
    if (anonId && /^[0-9a-f-]{36}$/.test(anonId)) { // UUID 형식 검증
      const serviceClient = createServiceClient();
      const { data } = await serviceClient
        .from("interview_sessions")
        .select("id, created_at, job_category, reports(total_score)")
        .eq("anonymous_id", anonId)
        .order("created_at", { ascending: false });
      sessions = data ?? [];
    }
  }

  const history = sessions.map(s => ({
    id: s.id,
    date: new Date(s.created_at).toLocaleDateString("ko-KR"),
    jobCategories: (s.job_category as string).split(", "),
    score: (s.reports as { total_score: number }[])?.[0]?.total_score ?? 0,
  }));

  return (
    // 기존 JSX 구조 유지, history는 props로 전달
    // "use client" 제거, useState/useEffect 제거
    ...
  );
}
```

---

### Step 8: 테스트 코드

**파일**: `services/lww/src/app/auth/callback/__tests__/route.test.ts` (새 파일)

**테스트 케이스**:
1. `code` 없음 → `/login?error=oauth` 리다이렉트
2. `exchangeCodeForSession` 실패 → `/login?error=oauth` 리다이렉트
3. 성공 + `anonId` 있음 → `migrate_anon_to_user` RPC 호출 + `next` 리다이렉트
4. 성공 + `anonId` 없음 → RPC 호출 안 함 + `/` 리다이렉트
5. Open Redirect 방어: `next=//evil.com` → `/` 리다이렉트
6. 마이그레이션 RPC 실패 → 로그인은 성공, 에러 로그 기록

**파일**: `services/lww/src/middleware.test.ts` (새 파일)

**테스트 케이스**:
1. Rate limit 초과 → 429 반환
2. Rate limit 정상 → Supabase 세션 갱신 후 통과
3. Supabase 오류 → 세션 갱신 실패해도 요청 통과 (익명 기능 보호)

---

### Step 9: `services/lww/.ai.md` 최신화

**파일**: `services/lww/.ai.md`

추가할 내용:
- Phase 1 소셜 로그인 아키텍처 (익명 우선 원칙)
- auth 관련 파일 목록: `app/auth/callback/route.ts`, `app/(main)/login/page.tsx`
- dual-write 패턴 설명
- `migrate_anon_to_user` RPC 함수 위치 및 목적

---

## 파일 변경 요약

| 파일 | 작업 | 우선순위 |
|------|------|---------|
| Supabase SQL Editor | profiles 테이블, migrate_anon_to_user RPC | 최우선 |
| `src/middleware.ts` | 세션 갱신 추가, matcher 확장 | 최우선 |
| `src/app/auth/callback/route.ts` | 신규 생성 | 최우선 |
| `src/app/auth/confirm/route.ts` | 신규 생성 (이메일 확인) | 최우선 |
| `src/app/(main)/login/page.tsx` | 신규 생성 (소셜 + 이메일 탭) | 높음 |
| `src/app/api/interview/start/route.ts` | dual-write 추가 | 높음 |
| `src/app/api/interview/answer/route.ts` | dual-write 추가 | 높음 |
| `src/app/api/interview/end/route.ts` | dual-write 추가 | 높음 |
| `src/components/interview/SaveAccountCTA.tsx` | 신규 생성 | 높음 |
| `src/app/(main)/interview/page.tsx` | Server Component 전환 | 높음 |
| `src/app/auth/callback/__tests__/route.test.ts` | 신규 생성 | 중간 |
| `src/middleware.test.ts` | 신규 생성 | 중간 |
| `services/lww/.ai.md` | 최신화 | 완료 후 |

---

## 알려진 제약사항

- **공유 기기 시나리오**: User A 로그아웃 → User B 로그인 시 User A의 `anon_id` 쿠키가 남아 있으면 User B 계정에 User A의 익명 세션이 연결될 수 있음. RPC의 `user_id IS NULL` 가드로 부분 완화. 전면 해결은 Phase 2 (쿠키 로테이션) 과제.
- **카카오 OAuth**: Supabase에서 Kakao provider 활성화 후 별도 Kakao Developers 앱 등록 필요.
