# [#171] feat: [seung] UX 흐름 개선 — 면접 진행성·리다이렉트·접근성 수정 — 구현 계획

> 작성: 2026-03-20

---

## 완료 기준

- [x] 면접 헤더에 "나가기" 버튼 추가 → /dashboard 이동
- [x] 리포트 생성 조건 완화: report/generate/route.ts sessionComplete 게이트 제거, InterviewChat 리포트 버튼을 답변 5개 이상 시 노출 (엔진이 history < 5 시 422)
- [x] 면접 진행률 표시 — 답변 완료 수 / 총 질문 수 (세션 API 응답에 totalQuestions 추가)
- [x] 에러·파라미터 누락 리다이렉트 수정: interview/page.tsx · report/page.tsx · diagnosis/page.tsx /resume → /dashboard
- [x] report 페이지 growthCurve 플레이스홀더 숨김
- [x] 대시보드 진행 중 세션 "이어하기": /api/dashboard에서 sessionComplete=false 세션 포함, ResumeCard에 이어하기 버튼 추가
- [x] AnswerInput beforeunload 이탈 경고 (textarea 내용 있을 때만)
- [x] 대시보드 리포트 복수 접근: /api/dashboard 응답에 reports 배열 추가, ResumeCard에 세션별 리포트 링크 목록 표시
- [x] 테스트 코드 포함
- [x] 해당 디렉토리 .ai.md 최신화
- [x] 불변식 위반 없음

---

## 구현 계획

### 전체 Step 요약

| Step | 내용 | 변경 파일 |
|------|------|-----------|
| 1 | 단순 수정 — 리다이렉트·growthCurve·헤더 나가기 버튼 | `interview/page.tsx`, `report/page.tsx`, `diagnosis/page.tsx` |
| 2 | 리포트 조건 완화 — sessionComplete 게이트 제거, 5개 이상 버튼 노출 | `api/report/generate/route.ts`, `InterviewChat.tsx`, `report-generate.test.ts`, `InterviewChat.test.tsx` |
| 3 | 면접 진행률 표시 — totalQuestions (answerCount는 InterviewChat 내부 계산) | `api/interview/session/route.ts`, `interview/page.tsx`, `InterviewChat.tsx`, `interview-session.test.ts` |
| 4 | beforeunload 이탈 경고 | `AnswerInput.tsx`, `AnswerInput.test.tsx` (신규) |
| 5 | 대시보드 이어하기 + 복수 리포트 | `types.ts`, `api/dashboard/route.ts`, `dashboard/page.tsx`, `dashboard.test.ts` |

---

### Step 1 — 단순 수정 (리다이렉트 · growthCurve · 헤더 나가기)

변경 파일이 서로 독립적이어서 한꺼번에 처리한다.

#### 1-1. 리다이렉트 `/resume` → `/dashboard` 수정

| 파일 | 위치 | 변경 내용 |
|------|------|-----------|
| `services/seung/src/app/interview/page.tsx` | L37, L49, L89 | `'/resume'` → `'/dashboard'` |
| `services/seung/src/app/report/page.tsx` | L36, L43, L53 | `'/resume'` → `'/dashboard'` |
| `services/seung/src/app/diagnosis/page.tsx` | L33, L40, L50 | `'/resume'` → `'/dashboard'` |

#### 1-2. report 페이지 growthCurve 플레이스홀더 숨김

- `services/seung/src/app/report/page.tsx` L152-155 — 해당 `<section>` 블록 삭제

#### 1-3. 면접 헤더 "나가기" 버튼 추가

- `services/seung/src/app/interview/page.tsx` — `<header>` 태그 내부에 나가기 버튼 추가
  ```tsx
  // 변경 전
  <header className="...">
    <h1 ...>MirAI — 패널 면접</h1>
  </header>

  // 변경 후
  <header className="... flex items-center justify-between">
    <h1 ...>MirAI — 패널 면접</h1>
    <button onClick={() => router.push('/dashboard')} className="...">
      나가기
    </button>
  </header>
  ```

---

### Step 2 — 리포트 생성 조건 완화

#### 2-1. `api/report/generate/route.ts` — sessionComplete 게이트 제거

- L60-63의 `if (!session.sessionComplete)` 블록 삭제
- 엔진이 history < 5이면 422를 반환하므로 서비스 측 게이트 불필요

#### 2-2. `InterviewChat.tsx` — 리포트 버튼 노출 조건 변경

현재: `sessionComplete` 블록 안에서만 리포트 버튼 표시
변경: `messages`에서 answer 개수를 내부 계산 → **answerCount >= 5이면 항상 리포트 버튼 표시**

```tsx
// InterviewChat 내부 계산 (props 추가 불필요)
const answerCount = messages.filter((m) => m.type === 'answer').length

// sessionComplete 블록과 별도로, 진행 중에도 버튼 노출
{!sessionComplete && answerCount >= 5 && onReport && (
  <div className="flex justify-end">
    <button onClick={onReport} disabled={isGeneratingReport} className="...">
      {isGeneratingReport ? '리포트 생성 중...' : '리포트 생성하기'}
    </button>
  </div>
)}
```

#### 2-3. `tests/api/report-generate.test.ts` 업데이트

- `sessionComplete=false → 400` 케이스 → 삭제 (게이트 제거됨)
- sessionComplete=false 세션에서도 엔진 호출이 일어나는 성공 케이스 추가

#### 2-4. `tests/components/InterviewChat.test.tsx` 업데이트

- answerCount >= 5 + !sessionComplete 조건에서 리포트 버튼 노출 케이스 추가
- answerCount < 5일 때 버튼 미노출 케이스 추가

---

### Step 3 — 면접 진행률 표시

#### 3-1. `api/interview/session/route.ts` — totalQuestions 추가

`questionsQueue`를 select에 추가하고 totalQuestions를 계산:

```ts
// session 타입에 questionsQueue 추가
let session: {
  ...,
  questionsQueue: unknown,  // 추가
} | null

// select 추가
select: {
  ...,
  questionsQueue: true,
}

// 응답 계산 (answerCount는 API 응답에 포함하지 않음 — InterviewChat이 messages에서 계산)
const queue = Array.isArray(session.questionsQueue) ? session.questionsQueue : []
const historyLen = Array.isArray(session.history) ? (session.history as unknown[]).length : 0
const totalQuestions = historyLen + queue.length + (session.sessionComplete ? 0 : 1)

return NextResponse.json({
  ...,
  totalQuestions,
})
```

#### 3-2. `interview/page.tsx` — totalQuestions state만 관리

```tsx
const [totalQuestions, setTotalQuestions] = useState(0)

// session fetch then 콜백에서
setTotalQuestions(data.totalQuestions ?? 0)

// answerCount state는 추가하지 않음 — InterviewChat이 messages에서 직접 계산
```

#### 3-3. `InterviewChat.tsx` — totalQuestions prop 추가, answerCount 내부 계산

```tsx
type Props = {
  ...,
  totalQuestions?: number   // API에서 받은 총 질문 수
  // answerCount는 props 아님 — messages에서 내부 계산
}

// 컴포넌트 내부
const answerCount = messages.filter((m) => m.type === 'answer').length

// 메시지 목록 상단에 진행률 표시
{(totalQuestions ?? 0) > 0 && (
  <p className="text-sm text-gray-400 text-right">
    {answerCount} / {totalQuestions} 답변 완료
  </p>
)}
```

#### 3-4. `tests/api/interview-session.test.ts` 업데이트

- mock 세션 데이터에 `questionsQueue: []` 추가 (select에 포함되므로 필수)
- 성공 케이스에 `totalQuestions` 응답 포함 검증 추가 (`answerCount`는 검증 불필요)

---

### Step 4 — AnswerInput beforeunload 이탈 경고

`services/seung/src/components/AnswerInput.tsx` 수정:

- textarea를 **controlled input**으로 전환 (value state 추가)
- `useEffect`로 `window.beforeunload` 이벤트 등록 — value가 비어있지 않을 때만 경고
- 기존 uncontrolled 방식의 `e.currentTarget.reset()` 및 DOM 기반 char-counter 제거 → `value.length`로 통합

```tsx
import { useState, useEffect } from 'react'

export default function AnswerInput({ onSubmit, disabled = false, hidden = false }: Props) {
  const [value, setValue] = useState('')

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (value.trim()) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [value])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const answer = value.trim()
    if (!answer) return
    onSubmit(answer)
    setValue('')  // reset 대신 state 초기화
  }

  if (hidden) return null

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        name="answer"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={MAX_LENGTH}
        disabled={disabled}
        placeholder="답변을 입력하세요..."
        className="..."
        rows={4}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {value.length} / {MAX_LENGTH}  {/* DOM 조작 제거, value.length로 대체 */}
        </span>
        <button type="submit" disabled={disabled} className="...">
          {disabled ? '처리 중...' : '답변 제출'}
        </button>
      </div>
    </form>
  )
}
```

#### 4-1. `tests/components/AnswerInput.test.tsx` 신규 추가

현재 테스트 파일 없음 → 신규 생성:
- textarea에 내용 있을 때 `beforeunload` 이벤트 핸들러 등록 확인
- textarea가 비어있을 때 `beforeunload` 경고 미발생 확인
- 제출 후 value가 빈 문자열로 초기화되는지 확인
- `hidden=true`일 때 컴포넌트가 렌더링되지 않는지 확인

---

### Step 5 — 대시보드 이어하기 + 복수 리포트

#### 5-1. `types.ts` — DashboardResumeItem 확장

```ts
export type DashboardResumeItem = {
  id: string
  createdAt: string
  fileName: string
  sessionCount: number
  hasReport: boolean           // 하위 호환 유지
  reportId: string | null      // 하위 호환 유지 (가장 오래된 리포트 id)
  hasDiagnosis: boolean
  inProgressSessionId: string | null   // NEW: 진행 중 세션 id
  reports: { id: string; sessionId: string; createdAt: string }[]  // NEW: 전체 리포트 목록
}
```

#### 5-2. `api/dashboard/route.ts` — 스키마 확장

```ts
// sessions include는 기존 유지 (include: { report: true } — 전체 필드 포함되므로 updatedAt 사용 가능)

// result.map 수정
// TypeScript: filter 후에도 s.report가 null로 추론되는 문제 → 타입 가드로 해결
const sessionsWithReport = resume.sessions.filter(
  (s): s is typeof s & { report: NonNullable<typeof s.report> } => s.report !== null
)
const allReports = sessionsWithReport.map((s) => ({
  id: s.report.id,
  sessionId: s.id,
  createdAt: s.report.createdAt.toISOString(),
}))

const inProgressSession = resume.sessions
  .filter((s) => !s.sessionComplete)
  .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]

return {
  ...,
  inProgressSessionId: inProgressSession?.id ?? null,
  reports: allReports,
}
```

> **주의**: `s.report!` non-null assertion 대신 타입 가드 filter를 사용해 TypeScript 안전성 확보.
> `updatedAt` 정렬을 위해 sessions include에 `select` 없이 전체 필드를 include (schema.prisma에 `updatedAt` 확인 완료).

#### 5-3. `dashboard/page.tsx` (ResumeCard) — UI 업데이트

```tsx
// 이어하기 버튼
{item.inProgressSessionId && (
  <button
    onClick={() => router.push(`/interview?sessionId=${item.inProgressSessionId}`)}
    className="rounded-md bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
  >
    이어하기
  </button>
)}

// 리포트 목록 (reports 배열 사용, 기존 단일 reportId 대체)
{item.reports.map((r, i) => (
  <button
    key={r.id}
    onClick={() => router.push(`/report?reportId=${r.id}`)}
    className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
  >
    역량 리포트 {item.reports.length > 1 ? `#${i + 1}` : ''}
  </button>
))}
```

기존 `{item.hasReport && item.reportId && ...}` 블록은 제거 (reports 배열로 대체).

#### 5-4. `tests/api/dashboard.test.ts` 업데이트

- 기존 mock에 `sessionComplete`, `updatedAt` 추가
- `inProgressSessionId`, `reports` 필드 검증 케이스 추가
- 진행 중 세션이 있는 resume 케이스 추가

---

### 작업 순서 요약

| 순서 | 대상 | 의존성 |
|------|------|--------|
| 1 | Step 1 (리다이렉트·growthCurve·헤더) | 없음 |
| 2 | Step 2 (리포트 조건 완화) | 없음 |
| 3 | Step 3 (진행률) | 없음 (Step 2와 병렬 가능) |
| 4 | Step 4 (beforeunload) | 없음 |
| 5 | Step 5 (이어하기·복수 리포트) | 없음 |
| 6 | 테스트 전체 실행 확인 | 1~5 완료 후 |
| 7 | .ai.md 최신화 | 6 완료 후 |

---

### 주의사항

- `InterviewSession.questionsQueue` (Json)은 배열 타입임을 가정 — `Array.isArray` 방어 처리 필수
- `interview-session.test.ts` mock에 `questionsQueue: []` 추가 필요 — select에 포함되므로 없으면 undefined 오류
- `dashboard/route.ts`에서 `s.report!` non-null assertion 금지 — 타입 가드 filter로 대체
- `dashboard.test.ts` mock 데이터에 `sessionComplete`, `updatedAt`, `report.createdAt` 필드 추가 필요
- `AnswerInput` controlled 전환 시 기존 `e.currentTarget.reset()` 및 DOM 기반 char-counter 완전 제거 — value state로 통합
- `answerCount`는 API 응답 및 props에 포함하지 않음 — `InterviewChat` 내부에서 messages 기반으로 계산
- 기존 `hasReport`, `reportId` 필드는 types.ts에 유지하되, ResumeCard UI는 `reports` 배열로 대체
