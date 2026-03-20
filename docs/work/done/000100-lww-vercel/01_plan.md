# [#100] chore: lww 서비스 Vercel 배포 — 구현 계획

> 작성: 2026-03-20

---

## 완료 기준

### Vercel 배포
- [ ] `next.config.ts`에서 `output: 'standalone'` 제거 (Vercel 기본값 사용)
- [ ] `vercel.json` 추가 — `/api/interview/end`에 `maxDuration: 110` 설정
- [ ] `.env.example` 추가 (아래 환경변수 목록 기준)
- [ ] Vercel 프로젝트 생성: 루트 디렉토리 `services/lww`, 프레임워크 Next.js
- [ ] Vercel 대시보드에 환경변수 설정
- [ ] 배포 성공 확인 (빌드 에러 없음)
- [ ] 배포 URL 팀 공유

### Supabase 연동 (MVP 범위)
- [ ] `@supabase/ssr`, `@supabase/supabase-js` 패키지 설치
- [ ] `src/lib/supabase/server.ts` 생성 — createServerClient (seung 서비스 패턴 동일)
- [ ] `src/lib/supabase/browser.ts` 생성 — createBrowserClient
- [ ] Supabase에 MVP 테이블 2개 마이그레이션 실행 (`interview_sessions`, `reports` — dev_spec.md §DB 스키마 기준)
- [ ] `/api/interview/start`: sessionId + 첫 질문 DB 저장 (`interview_sessions` INSERT)
- [ ] `/api/interview/answer`: history + questionsQueue DB 갱신 (`interview_sessions` UPDATE)
- [ ] `/api/interview/end`: 리포트 DB 저장 (`reports` INSERT, status: 'completed')
- [ ] RLS 정책 적용 (비로그인: `anonymous_id` 검증, dev_spec.md 참조)

### 기타
- [ ] `middleware.ts` in-memory rate limiter 주석에 Upstash Redis 마이그레이션 필요 명시
- [ ] 해당 디렉토리 .ai.md 최신화

---

## 구현 계획

> v2 (2026-03-20): 전문가 리뷰 반영 — anonymous_id 서버 쿠키 방식으로 전환, zod 스키마 명시, personaLabel 매핑, 보안 취약점 수정

---

### Step 0 — 사전 보안 패치

```bash
# services/lww 디렉토리에서
cd services/lww && npm audit fix
```

> **이유**: Next.js HTTP Request Smuggling CVE 패치 버전 존재 (Security Reviewer HIGH-3). 배포 전 반드시 실행.

---

### Step 1 — Vercel 설정 파일

**1-1.** `services/lww/next.config.ts` line 4 — `output: 'standalone'` 제거

```ts
// before
const nextConfig: NextConfig = { output: 'standalone' };
// after
const nextConfig: NextConfig = {};
```

> ⚠️ Docker CI가 있다면 이 변경으로 Docker 빌드가 깨짐. `AGENTS.md`/CI 설정 먼저 확인.

**1-2.** `services/lww/vercel.json` 신규 생성

```json
{
  "functions": {
    "src/app/api/interview/end/route.ts": {
      "maxDuration": 110
    }
  }
}
```

> `end/route.ts`에 이미 `export const maxDuration = 110` 있음. 둘 다 유지 (안전 중복).

---

### Step 2 — Supabase 패키지 설치 및 클라이언트 생성

**2-1.** `services/lww` 디렉토리에서 설치

```bash
npm install @supabase/ssr @supabase/supabase-js
```

**2-2.** `services/lww/src/lib/supabase/server.ts` 신규 생성

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// 쿠키 기반 인증 클라이언트 (Phase 1 대비)
export async function createClient() {
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

// 서버 API 라우트 전용 — service_role (RLS INSERT 정책 없으므로 우회, 최소 사용 원칙)
export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}
```

**2-3.** `services/lww/src/lib/supabase/browser.ts` 신규 생성

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

---

### Step 3 — DB 마이그레이션 (수동 작업)

Supabase 대시보드 → SQL Editor에서 `docs/specs/lww/dev_spec.md §DB 스키마` SQL 실행:

1. `interview_sessions` 테이블 + RLS 정책
2. `reports` 테이블 + RLS 정책

완료 후 Table Editor에서 두 테이블이 생성되었는지 확인.

> **주의**: `answers jsonb not null default '[]'` — INSERT 시 생략 가능 (DB default 처리됨).
> **주의**: INSERT RLS 정책은 dev_spec.md에 없음 → service_role key로 처리.

---

### Step 4 — anonymous_id 서버 쿠키 유틸 생성

> **설계 결정**: `anonymous_id`를 클라이언트 바디로 전달하지 않는다.
> 서버가 생성하고 HttpOnly 쿠키로 관리 → 클라이언트 변조 불가 (IDOR 방지).

**4-1.** `services/lww/src/lib/anon-cookie.ts` 신규 생성

```ts
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const COOKIE_NAME = 'lww_anon_id'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 24 * 365, // 1년
  path: '/',
}

/**
 * 요청 쿠키에서 anonymousId를 읽는다.
 * 없으면 새로 생성하고, response에 Set-Cookie를 추가할 준비를 한다.
 */
export async function getOrCreateAnonId(): Promise<{
  anonymousId: string
  isNew: boolean
}> {
  const cookieStore = await cookies()
  const existing = cookieStore.get(COOKIE_NAME)?.value
  if (existing) return { anonymousId: existing, isNew: false }
  return { anonymousId: crypto.randomUUID(), isNew: true }
}

/**
 * NextResponse에 anonymousId 쿠키를 설정한다 (isNew일 때만 호출).
 */
export function setAnonCookie(response: NextResponse, anonymousId: string): NextResponse {
  response.cookies.set(COOKIE_NAME, anonymousId, COOKIE_OPTIONS)
  return response
}
```

---

### Step 5 — API 라우트 DB 연동

모든 API 라우트에서 `createServiceClient()` 사용.

**PERSONA_LABELS 서버 상수** (각 라우트 파일 상단에 추가):

```ts
const PERSONA_LABELS: Record<string, string> = {
  hr: 'HR 면접관',
  tech_lead: '기술 리드',
  executive: '임원 면접관',
}
```

---

**5-1.** `services/lww/src/app/api/interview/start/route.ts`

zod 스키마 변경:
```ts
// 기존
const startSchema = z.object({
  jobCategories: z.array(z.string().min(1)).min(1).max(3),
  careerStage: z.string().min(1),
})
// 변경 — anonymousId 제거 (서버 쿠키로 관리)
// 스키마 변경 없음
```

쿠키 + DB INSERT 로직 추가:
```ts
import { getOrCreateAnonId, setAnonCookie } from '@/lib/anon-cookie'
import { createServiceClient } from '@/lib/supabase/server'

// POST 핸들러 내부, 엔진 호출 성공 후:
const { anonymousId, isNew } = await getOrCreateAnonId()
const supabase = createServiceClient()

const { error: dbError } = await supabase.from('interview_sessions').insert({
  id: sessionId,
  anonymous_id: anonymousId,
  job_category: jobCategories.join(', '),
  questions: [data.firstQuestion, ...(data.questionsQueue ?? []).slice(0, 4)],
  history: [],
  questions_queue: (data.questionsQueue ?? []).slice(0, 4),
  status: 'in_progress',
  // answers: [] — default 처리됨, 명시적 포함 생략
})
if (dbError) console.error('[start] DB INSERT 실패 (non-fatal):', dbError)

const jsonResponse = NextResponse.json({
  sessionId,
  firstQuestion: data.firstQuestion,
  questionsQueue: (data.questionsQueue ?? []).slice(0, 4),
})
// 신규 익명 ID일 때만 Set-Cookie
return isNew ? setAnonCookie(jsonResponse, anonymousId) : jsonResponse
```

---

**5-2.** `services/lww/src/app/api/interview/answer/route.ts`

zod 스키마 변경:
```ts
const answerSchema = z.object({
  // 기존 필드 유지
  resumeText: z.string().min(1).max(10000),
  currentQuestion: z.string().min(1).max(2000),
  currentAnswer: z.string().min(1).max(5000),
  currentPersona: z.enum(['hr', 'tech_lead', 'executive']),
  history: z.array(historyItemSchema).max(20),
  questionsQueue: z.array(queueItemSchema),
  // 추가
  sessionId: z.string().uuid(),
})
```

쿠키 + DB UPDATE 로직 추가 (엔진 호출 성공 후):
```ts
import { getOrCreateAnonId } from '@/lib/anon-cookie'

const { anonymousId } = await getOrCreateAnonId()
const supabase = createServiceClient()

const newHistoryItem = {
  question: currentQuestion,
  answer: currentAnswer,
  persona: currentPersona,
  personaLabel: PERSONA_LABELS[currentPersona] ?? 'AI 면접관', // 빈 문자열 금지
}

const { error: dbError } = await supabase
  .from('interview_sessions')
  .update({
    history: [...history, newHistoryItem],
    questions_queue: data.updatedQueue ?? [],
    updated_at: new Date().toISOString(),
  })
  .eq('id', sessionId)
  .eq('anonymous_id', anonymousId) // IDOR 방지: 본인 세션만 수정 가능
if (dbError) console.error('[answer] DB UPDATE 실패 (non-fatal):', dbError)
// 응답 형식 유지 (nextQuestion, updatedQueue, sessionComplete) — 클라이언트 영향 없음
```

> `sessionId`가 DB에 없으면 UPDATE 0행 → silent no-op (MVP 허용).
> `sessionId`는 엔진 호출 바디에 포함하지 않는다 (엔진은 stateless, sessionId 불필요).

---

**5-3.** `services/lww/src/app/api/interview/end/route.ts`

zod 스키마 변경:
```ts
const endSchema = z.object({
  resumeText: z.string().min(1).max(10000),
  history: z.array(historyItemSchema).min(5),
  // 추가
  sessionId: z.string().uuid(),
})
// anonymousId는 쿠키에서 읽으므로 바디 불필요
```

쿠키 + DB INSERT/UPDATE 로직 추가 (엔진 호출 성공 후):
```ts
import { getOrCreateAnonId } from '@/lib/anon-cookie'

const { anonymousId } = await getOrCreateAnonId()
const supabase = createServiceClient()

const { data: reportRow, error: reportErr } = await supabase
  .from('reports')
  .insert({
    session_id: sessionId,
    anonymous_id: anonymousId,
    status: 'completed',
    total_score: report.totalScore,
    axis_scores: report.axisScores,
    axis_feedbacks: report.axisFeedbacks,
    summary: report.summary,
  })
  .select('id')
  .single()

if (reportErr) {
  console.error('[end] reports INSERT 실패 (non-fatal):', reportErr)
} else {
  await supabase
    .from('interview_sessions')
    .update({
      status: 'completed',
      report_id: reportRow.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('anonymous_id', anonymousId) // IDOR 방지
}
// 응답 형식 유지 ({ report }) — 클라이언트 영향 없음
```

> **롤백 전략**: DB 실패는 non-fatal — 엔진 응답 정상 반환, 로그만 남김. Phase 1에서 트랜잭션 추가.

---

### Step 6 — 클라이언트 코드 수정

**6-1.** `services/lww/src/hooks/useInterview.ts`

`sendAnswer` 함수: `sessionId` 추가 (출처: `state.sessionId`)

```ts
body: JSON.stringify({
  resumeText: state.resumeText,
  currentQuestion,
  currentAnswer: answer,
  currentPersona,
  history: state.history,
  questionsQueue: state.questionsQueue,
  sessionId: state.sessionId, // 추가 — state에서 가져옴 (새 prop 불필요)
}),
```

`endInterview` 함수: `sessionId` 추가 (anonymousId는 서버 쿠키로 처리, 불필요)

```ts
body: JSON.stringify({
  resumeText: state.resumeText,
  history: state.history,
  sessionId: state.sessionId, // 추가
  // anonymousId 없음 — 서버가 쿠키에서 읽음
}),
```

**6-2.** `services/lww/src/app/(main)/onboarding/page.tsx`

변경 없음 — `anonymousId`를 바디에 전달할 필요가 없음. 서버가 쿠키로 처리.

> `anonymous-id.ts` 파일 생성 불필요 (Step 4 방식 변경으로 제거됨).

---

### Step 7 — 기존 테스트 업데이트

**7-1.** `services/lww/src/app/api/interview/__tests__/start.test.ts`

`anonymousId` 관련 변경 없음 (클라이언트 바디에 추가하지 않으므로 기존 테스트 통과).
`sessionId` 관련: `/start`는 `sessionId`를 바디에서 받지 않으므로 기존 테스트 통과.

**7-2.** 신규 테스트 추가 (선택, CLAUDE.md "테스트 먼저" 원칙):
- `anonymous_id` 쿠키가 없을 때 `/start`가 Set-Cookie 응답을 반환하는지 확인
- `sessionId` 없이 `/answer` 호출 시 400 반환하는지 확인 (zod 스키마)
- `sessionId` 없이 `/end` 호출 시 400 반환하는지 확인

---

### Step 8 — Vercel 배포 (수동)

1. [vercel.com](https://vercel.com) → New Project → GitHub 레포 선택
2. Root Directory: `services/lww`
3. Framework Preset: Next.js (자동 감지)
4. 환경변수 설정 (`.env.example` 기준):
   - `ENGINE_BASE_URL` — Production only
   - `NEXT_PUBLIC_SUPABASE_URL` — All
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — All
   - `SUPABASE_SERVICE_ROLE_KEY` — Production only (절대 `NEXT_PUBLIC_` 금지)
   - `NEXT_PUBLIC_SITE_URL` — All
5. Deploy → 빌드 로그 확인 (tsc 에러 0)
6. 배포 URL 팀 Slack/Discord 공유

---

### Step 9 — .ai.md 최신화

`services/lww/.ai.md` 업데이트:
- Vercel 배포 URL
- Supabase 연동 완료 (테이블: `interview_sessions`, `reports`)
- Supabase 클라이언트 위치: `src/lib/supabase/`
- anonymous_id 관리: `src/lib/anon-cookie.ts` (서버 HttpOnly 쿠키)
- 환경변수 목록

---

### 테스트 전략

| 항목 | 방법 |
|------|------|
| 보안 패치 | `npm audit` — 0 high/critical vulnerabilities |
| 빌드 성공 | `npm run build` (services/lww) — tsc 0 errors |
| 쿠키 발급 | `/api/interview/start` 첫 호출 → Set-Cookie `lww_anon_id` 응답 헤더 확인 |
| 쿠키 재사용 | `/start` 재호출 → Set-Cookie 없음 확인 (기존 쿠키 유지) |
| DB 저장 | Supabase Table Editor에서 `interview_sessions`, `reports` 행 확인 |
| DB 실패 내성 | Supabase URL 임시 변경 → 면접 세션 정상 진행 확인 (non-fatal) |
| Vercel E2E | 배포 URL 접속 + 면접 세션 1회 완주 수동 확인 |
| 기존 E2E | 로컬에서 기존 Playwright E2E 3회 PASS 유지 확인 |

---

### 주의사항 및 알려진 한계

| 항목 | 내용 |
|------|------|
| `anonymous_id` 보안 | 서버 HttpOnly 쿠키로 관리 — 클라이언트 변조 불가 |
| `SUPABASE_SERVICE_ROLE_KEY` | 절대 `NEXT_PUBLIC_` 금지, 서버 전용 |
| `output: 'standalone'` 제거 | Docker 배포 시 재추가 필요 (현재 Vercel 전용) |
| RLS INSERT 정책 | dev_spec.md에 없음 → service_role 우회. Phase 1 로그인 추가 시 정책 보완 필요 |
| Rate Limiter 무력화 | Vercel 서버리스에서 in-memory rate limiter 비효과적 → **별도 이슈로 분리** (Upstash Redis 교체) |
| `resumeText` 클라이언트 전달 | DB 연동 완료 후 서버에서 세션 조회로 대체 가능 — Phase 1 개선 항목 |
| `sessionId` 존재 검증 없음 | 잘못된 UUID로 UPDATE 시 0행 silent no-op — MVP 허용, 로그로 감지 |
