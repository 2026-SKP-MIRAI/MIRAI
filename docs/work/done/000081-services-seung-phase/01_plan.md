# [#81] feat: services/seung Phase 2 — 역량 평가 리포트 구현 — 구현 계획

> 작성: 2026-03-16

---

## 완료 기준

- [x] `lib/types.ts`에 `AxisScores`, `AxisFeedback`, `ReportResponse` 타입 추가
- [x] `Report` Prisma 모델 추가 (`id`, `sessionId` FK → InterviewSession, `totalScore Int`, `scores Json`, `summary String`, `axisFeedbacks Json`, `createdAt DateTime @default(now())`) + `prisma migrate dev` + Supabase RLS SQL 마이그레이션
- [x] `POST /api/report/generate` 라우트: `sessionComplete === false` → 400 / 동일 sessionId Report 기존재 시 기존 `reportId` 반환 / 엔진 호출 (`AbortSignal.timeout(90_000)`, `maxDuration = 100`) / 엔진 422(InsufficientAnswersError) → 서비스 422 반환 / Report 저장 → `reportId` 반환
- [x] `GET /api/report?reportId=xxx` 라우트: DB 조회 후 반환, 없으면 404
- [x] `InterviewChat` 컴포넌트: `onReport?: () => void` prop 추가, 면접 완료 블록에 "리포트 생성하기"(로딩 스피너) + "다시 시작" 버튼 병렬 표시
- [x] `/interview` 페이지: `isGeneratingReport` 상태 + `handleReport` 핸들러 — 로딩 중 버튼 비활성화, 완료 시 `/report?reportId=xxx` 이동, 에러 시 인라인 메시지 표시
- [x] `/report` 페이지: Suspense 래퍼(`useSearchParams`), `reportId` 없거나 404 시 `/resume` redirect, 총점·8축 점수(숫자+프로그레스 바)·종합 요약·축별 피드백 카드·"홈으로" 버튼 표시
- [x] Vitest 단위 테스트 (mockPrisma에 `report.findFirst`, `report.create` 포함)
- [x] Playwright E2E (`test.setTimeout(120_000)` 이상, 면접 완료 → 리포트 생성 → 리포트 페이지 전 과정)
- [x] `services/seung/.ai.md` 최신화

---

## 구현 계획

### 핵심 설계 원칙

- 엔진 계약 우선 — `axisFeedbacks` 필드명 사용 (`dev_spec.md`의 `actionItems` 무시)
- LLM 직접 호출 금지 — 반드시 엔진 경유 (아키텍처 불변식)
- 멱등성 보장 — 동일 `sessionId` 재호출 시 기존 `reportId` 반환

### 핵심 고민 포인트

**1. timeout 설정**
엔진 내부 LLM timeout이 60s이므로, 서비스 fetch timeout을 **90s**로 설정해야 합니다.
Vercel function도 기본 10s가 상한이므로 `maxDuration = 100`을 명시했습니다.

**2. 중복 리포트 방지 (멱등성)**
사용자가 버튼을 여러 번 클릭하거나 네트워크 재시도가 발생할 경우, 리포트가 중복 생성되면 안 됩니다.
두 가지 레이어로 처리했습니다:
- 엔진 호출 전 `report.findFirst`로 기존 리포트 확인 → 있으면 바로 반환
- `sessionId @unique` 제약으로 DB 레벨 방어 → 동시 요청 시 P2002를 catch해서 기존 ID 반환

**3. 리포트 생성 방식 — 동기 vs 비동기**
비동기 큐/폴링(POST → pending → GET polling)이 race condition을 완전히 해결하지만, Redis/BullMQ 인프라가 필요해 현재 범위를 초과합니다.
동기 90s fetch로도 엔진 응답(12~18s)을 충분히 수용할 수 있어 동기 방식을 선택했습니다.
→ Phase 3에서 `Report.status` 필드 추가 및 비동기 패턴 전환 검토 예정

**4. DB 쿼리 방식**
세션 조회 시 `resume`를 `include`해서 1회 쿼리로 `resumeText`까지 획득합니다.
기존 `answer/route.ts`처럼 resume를 별도 쿼리하면 round-trip이 늘어납니다.

---

### 구현 단계

#### Step 1: `src/lib/types.ts` 타입 추가

```typescript
// 엔진 계약 타입
export type AxisScores = {
  communication: number
  problemSolving: number
  logicalThinking: number
  jobExpertise: number
  cultureFit: number
  leadership: number
  creativity: number
  sincerity: number
}

export type AxisFeedback = {
  axis: string
  axisLabel: string
  score: number
  type: 'strength' | 'improvement'
  feedback: string
}

export type EngineReportResponse = {
  scores: AxisScores
  totalScore: number
  summary: string
  axisFeedbacks: AxisFeedback[]
  growthCurve: null
}

// 서비스 응답 타입
export type ReportData = {
  id: string
  sessionId: string
  totalScore: number
  scores: AxisScores
  summary: string
  axisFeedbacks: AxisFeedback[]
  createdAt: string
}

// StoredHistoryEntry — interview/answer/route.ts에서 추출 (중복 제거)
export type StoredHistoryEntry = HistoryItem & { questionType?: string }
```

> **주의**: `StoredHistoryEntry` 추출 후 `src/app/api/interview/answer/route.ts:68`의 로컬 타입 정의를 import로 교체

---

#### Step 2: Prisma 스키마 (`prisma/schema.prisma`)

```prisma
model Report {
  id            String           @id @default(cuid())
  sessionId     String           @unique
  session       InterviewSession @relation(fields: [sessionId], references: [id])
  totalScore    Int
  scores        Json
  summary       String
  axisFeedbacks Json
  createdAt     DateTime         @default(now())
}
```

`InterviewSession` 모델에 역관계 추가:
```prisma
report Report?
```

마이그레이션:
```bash
cd services/seung && npx prisma migrate dev --name add-report
```

Supabase RLS SQL (마이그레이션 후 별도 실행):
```sql
ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full" ON "Report" FOR ALL USING (true);
```

---

#### Step 3: `src/app/api/report/generate/route.ts` (신규)

```typescript
export const maxDuration = 100  // Vercel function timeout
const ENGINE_FETCH_TIMEOUT_MS = 90_000

export async function POST(request: NextRequest) {
  // 1. body 파싱: { sessionId }
  // 2. sessionId 없으면 400

  // 3. ENGINE_BASE_URL 없으면 500
  const engineUrl = process.env.ENGINE_BASE_URL
  if (!engineUrl) return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })

  // 4. session + resume include 1회 쿼리
  //    prisma.interviewSession.findUnique({
  //      where: { id: sessionId },
  //      include: { resume: { select: { resumeText: true } } }
  //    }) → 없으면 404

  // 5. sessionComplete === false → 400 "면접이 아직 완료되지 않았습니다."

  // 6. 중복 체크: prisma.report.findFirst({ where: { sessionId } })
  //    → 있으면 200 + { reportId: existing.id }

  // 7. history에서 questionType 제거 (StoredHistoryEntry 타입)
  //    (session.history as StoredHistoryEntry[]).map(({ questionType: _qt, ...rest }) => rest)

  // 8. 엔진 호출
  //    fetch(`${engineUrl}/api/report/generate`, {
  //      method: 'POST',
  //      body: JSON.stringify({ resumeText, history }),
  //      signal: AbortSignal.timeout(ENGINE_FETCH_TIMEOUT_MS)
  //    })

  // 9. 엔진 422 → 서비스 422 "답변이 부족합니다. 더 많은 질문에 답변해 주세요."
  // 10. 엔진 500 / fetch 에러 → 서비스 500 "서버 오류가 발생했습니다."

  // 11. Math.round(engineData.totalScore)로 Int 보장

  // 12. Report 저장 (P2002 race condition 처리)
  //    try {
  //      const report = await prisma.report.create({
  //        data: { sessionId, totalScore, scores, summary, axisFeedbacks }
  //      })
  //      return NextResponse.json({ reportId: report.id }, { status: 201 })
  //    } catch (err) {
  //      if (err.code === 'P2002') {
  //        const existing = await prisma.report.findUnique({ where: { sessionId } })
  //        return NextResponse.json({ reportId: existing!.id }, { status: 200 })
  //      }
  //      return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  //    }
}
```

---

#### Step 4: `src/app/api/report/route.ts` (신규)

```typescript
export async function GET(request: NextRequest) {
  const reportId = request.nextUrl.searchParams.get('reportId')
  // reportId 없으면 400

  // prisma.report.findUnique({ where: { id: reportId } })
  // 없으면 404

  // scores, axisFeedbacks: Json → AxisScores, AxisFeedback[] 캐스팅 후 반환
  // return NextResponse.json(report as ReportData, { status: 200 })
}
```

---

#### Step 5: `src/components/InterviewChat.tsx` 수정

Props 타입에 추가:
```typescript
type Props = {
  messages: Message[]
  sessionComplete: boolean
  onRestart?: () => void
  onReport?: () => void           // 신규
  isGeneratingReport?: boolean    // 신규
}
```

`sessionComplete` 블록 수정 — 버튼 2개 병렬 표시:
```tsx
{sessionComplete && (
  <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
    <p className="mb-6 text-lg font-semibold text-gray-900">면접이 완료되었습니다.</p>
    <div className="flex justify-center gap-3">
      {onReport && (
        <button
          onClick={onReport}
          disabled={isGeneratingReport}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {isGeneratingReport ? '리포트 생성 중...' : '리포트 생성하기'}
        </button>
      )}
      {onRestart && (
        <button
          onClick={onRestart}
          disabled={isGeneratingReport}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          다시 시작
        </button>
      )}
    </div>
  </div>
)}
```

---

#### Step 6: `src/app/interview/page.tsx` 수정

`InterviewContent` 함수에 추가:
```typescript
const [isGeneratingReport, setIsGeneratingReport] = useState(false)
const [reportError, setReportError] = useState<string | null>(null)

const handleReport = async () => {
  if (!sessionId) return
  setIsGeneratingReport(true)
  setReportError(null)
  try {
    const res = await fetch('/api/report/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    const data = await res.json()
    if (!res.ok) {
      setReportError(data?.error ?? '리포트 생성에 실패했습니다. 다시 시도해 주세요.')
      return
    }
    router.push(`/report?reportId=${data.reportId}`)
  } catch {
    setReportError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.')
  } finally {
    setIsGeneratingReport(false)
  }
}
```

`InterviewChat` 컴포넌트 호출 시 prop 추가:
```tsx
<InterviewChat
  messages={messages}
  sessionComplete={sessionComplete}
  onRestart={handleRestart}
  onReport={handleReport}
  isGeneratingReport={isGeneratingReport}
/>
```

`reportError` 인라인 표시 (submitError 아래):
```tsx
{reportError && (
  <p role="alert" className="text-sm text-red-600 text-center px-4">
    {reportError}
  </p>
)}
```

---

#### Step 7: `/report` 페이지 (`src/app/report/page.tsx`, 신규)

```tsx
'use client'
import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { ReportData, AxisFeedback } from '@/lib/types'

// Suspense 래퍼 (interview/page.tsx 동일 패턴)
export default function ReportPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-gray-500">리포트를 불러오는 중...</p></div>}>
      <ReportContent />
    </Suspense>
  )
}

function ReportContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reportId = searchParams.get('reportId')
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!reportId) { router.replace('/resume'); return }
    fetch(`/api/report?reportId=${reportId}`)
      .then(r => { if (!r.ok) { router.replace('/resume'); return null } return r.json() })
      .then(data => { if (data) setReport(data) })
      .catch(() => router.replace('/resume'))
      .finally(() => setLoading(false))
  }, [reportId, router])

  if (loading) return <LoadingScreen />

  // UI 구성:
  // - 총점: 큰 숫자 표시
  // - 8축 점수: 각 축별 axisLabel + 숫자 + progress bar (score/100 * 100%)
  //   type='strength' → 파란색, 'improvement' → 주황색
  // - 종합 요약: report.summary
  // - 축별 피드백 카드: axisFeedbacks 순회
  // - "홈으로" 버튼 → router.push('/resume')
}
```

---

#### Step 8: Vitest 단위 테스트

**`tests/api/report-generate.test.ts`** (신규, 9개):

```typescript
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    interviewSession: { findUnique: vi.fn() },
    report: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
const mockFetch = vi.fn()
global.fetch = mockFetch
```

테스트 케이스:
1. 성공: sessionComplete=true → 엔진 호출 → report.create → `{ reportId }` 반환 (201)
2. sessionId 누락 → 400
3. ENGINE_BASE_URL 없음 → 500
4. 세션 없음 → 404
5. sessionComplete=false → 400
6. 기존 Report 있음 → findFirst hit → 기존 reportId 반환 (200), 엔진 미호출 확인
7. 엔진 422 → 서비스 422
8. 엔진 500 → 서비스 500
9. report.create P2002 에러 → findUnique fallback → 기존 reportId 반환 (200)

**`tests/api/report-get.test.ts`** (신규, 3개):
1. reportId 있음 → 200 + ReportData
2. reportId 없음 → 400
3. 리포트 없음 → 404

**`tests/components/InterviewChat.test.tsx`** 업데이트:
- `onReport` prop 전달 시 "리포트 생성하기" 버튼 표시 테스트
- `isGeneratingReport=true` 시 버튼 disabled 테스트

---

#### Step 9: Playwright E2E (`tests/e2e/report-flow.spec.ts`, 신규)

```typescript
import { test, expect } from '@playwright/test'

const MOCK_SESSION_COMPLETE = {
  currentQuestion: '', currentPersona: 'hr', currentPersonaLabel: 'HR 면접관',
  currentQuestionType: 'main', history: [], sessionComplete: true,
}
const MOCK_REPORT_GENERATE = { reportId: 'report-123' }
const MOCK_REPORT_DATA = {
  id: 'report-123', sessionId: 'session-456', totalScore: 75,
  scores: { communication: 80, problemSolving: 70, logicalThinking: 82,
            jobExpertise: 78, cultureFit: 88, leadership: 75, creativity: 60, sincerity: 55 },
  summary: '논리적 사고와 조직 적합성이 강점입니다.',
  axisFeedbacks: [
    { axis: 'communication', axisLabel: '의사소통', score: 80, type: 'strength', feedback: '명확하고 구체적인 답변' }
    // ... 7개 더
  ],
  createdAt: '2026-03-16T00:00:00.000Z',
}

test.describe('리포트 플로우', () => {
  test.setTimeout(120_000)

  test('면접 완료 → 리포트 생성하기 → 리포트 페이지 표시', async ({ page }) => {
    await page.route('**/api/interview/session*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SESSION_COMPLETE) })
    )
    await page.route('**/api/report/generate', route =>
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(MOCK_REPORT_GENERATE) })
    )
    await page.route('**/api/report*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_REPORT_DATA) })
    )

    await page.goto('/interview?sessionId=session-456')
    await expect(page.getByText('면접이 완료되었습니다.')).toBeVisible()
    await expect(page.getByRole('button', { name: '리포트 생성하기' })).toBeVisible()

    await page.getByRole('button', { name: '리포트 생성하기' }).click()
    await expect(page).toHaveURL(/\/report\?reportId=report-123/)
    await expect(page.getByText('75')).toBeVisible()  // 총점
    await expect(page.getByText('논리적 사고와 조직 적합성이 강점입니다.')).toBeVisible()
  })

  test('reportId 없이 /report 접근 시 /resume 리다이렉트', async ({ page }) => {
    await page.goto('/report')
    await expect(page).toHaveURL(/\/resume/)
  })
})
```

---

#### Step 10: `services/seung/.ai.md` 최신화

업데이트 항목:
- 구조 트리에 추가:
  - `src/app/report/page.tsx`
  - `src/app/api/report/generate/route.ts`
  - `src/app/api/report/route.ts`
  - `tests/api/report-generate.test.ts`
  - `tests/api/report-get.test.ts`
  - `tests/e2e/report-flow.spec.ts`
- Prisma 스키마에 `Report` 모델 반영
- 진행 상태: `- [x] Phase 2: 역량 평가 리포트` 체크 처리
- Phase 2+ TODO에서 역량 평가 항목 제거

---

### 구현 순서 (의존성 기반)

| # | 작업 | 파일 | 의존성 |
|---|------|------|--------|
| 1 | 타입 추가 + StoredHistoryEntry 추출 | `src/lib/types.ts`, `answer/route.ts` | - |
| 2 | Prisma 스키마 + migrate | `prisma/schema.prisma` | Step 1 |
| 3 | Vitest 테스트 작성 (Red) | `tests/api/report-*.test.ts` | Step 1, 2 |
| 4 | POST /api/report/generate 구현 (Green) | `src/app/api/report/generate/route.ts` | Step 3 |
| 5 | GET /api/report 구현 (Green) | `src/app/api/report/route.ts` | Step 3 |
| 6 | InterviewChat.tsx 수정 | `src/components/InterviewChat.tsx` | Step 1 |
| 7 | interview/page.tsx 수정 | `src/app/interview/page.tsx` | Step 4, 6 |
| 8 | /report 페이지 구현 | `src/app/report/page.tsx` | Step 5 |
| 9 | InterviewChat.test.tsx 업데이트 | `tests/components/InterviewChat.test.tsx` | Step 6 |
| 10 | Playwright E2E 작성 | `tests/e2e/report-flow.spec.ts` | Step 4, 5, 7, 8 |
| 11 | .ai.md 최신화 | `services/seung/.ai.md` | 전체 |

---

### 리스크 및 완화

| 리스크 | 완화 방법 |
|--------|----------|
| P2002 동시 요청 | `report.create` try/catch P2002 → `findUnique` fallback으로 기존 reportId 반환 |
| LLM 응답 지연 (최대 60s) | `maxDuration=100`, `AbortSignal.timeout(90_000)` |
| `totalScore` float 반환 | `Math.round(engineData.totalScore)` 후 DB 저장 |
| `useSearchParams` SSR 오류 | `Suspense` 래퍼 필수 |
| Supabase RLS 미적용 | `prisma migrate` 후 별도 SQL 실행 필수 |
| `scores`/`axisFeedbacks` Json 타입 손실 | GET 라우트에서 타입 캐스팅 (`as AxisScores`, `as AxisFeedback[]`) |

---

### 검증 단계

1. `cd services/seung && npx vitest run` → 단위 테스트 전체 통과
2. `npx playwright test tests/e2e/report-flow.spec.ts` → E2E 2개 통과
3. `npx prisma migrate status` → `add-report` 마이그레이션 적용 확인
4. `services/seung/.ai.md` 구조·진행 상태 업데이트 확인

---

### Changelog (적용된 Architect/Critic 개선)

- P2002 race condition 처리 추가 (Architect [Critical])
- `StoredHistoryEntry` 타입 `lib/types.ts`로 추출 (Architect [Medium])
- `Math.round(totalScore)` guard 추가 (Architect [Medium])
- `ENGINE_BASE_URL` 없음 테스트 케이스 추가 (Architect [Low])
- P2002 concurrent create 테스트 케이스 추가 (Architect [Low])
- `InterviewChat.test.tsx` 업데이트 명시 (Critic 노트)
- `sessionComplete=false` 에러 메시지 명시: "면접이 아직 완료되지 않았습니다." (Critic 노트)
