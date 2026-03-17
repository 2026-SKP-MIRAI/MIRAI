# [#123] feat: services/seung Phase 3 — 연습 모드 즉각 피드백 구현 — 구현 계획

> 작성: 2026-03-17

---

## 완료 기준

- [x] `lib/types.ts`에 `FeedbackDetail`, `ComparisonDelta`, `PracticeFeedbackRequest`, `PracticeFeedbackResponse` 타입 추가
- [x] `InterviewSession` Prisma 모델에 `interviewMode String @default("real")` 컬럼 추가 + `prisma migrate dev`
- [x] `POST /api/practice/feedback` 라우트: 엔진 포워딩 (`AbortSignal.timeout(40_000)`) → 엔진 400/500 그대로 반환
- [x] `POST /api/interview/start` 수정: `interviewMode` 수신 → DB 저장
- [x] `/resume` 페이지: 모드 선택 UI (실전 / 연습) → 선택 후 면접 시작
- [x] `InterviewChat` 컴포넌트: practice 모드 전용 피드백 블록(score·good/improve·keywords·guide) + "다시 답변하기" 버튼 + comparisonDelta 표시. `interviewMode` prop은 `"real"` 기본값으로 하위 호환 유지
- [x] Vitest 단위 + Playwright E2E 테스트 전체 통과 (기존 회귀 없음 포함)
- [x] `services/seung/.ai.md` 최신화

---

## 구현 계획

### 핵심 설계 원칙

- 엔진 계약 우선 — LLM 직접 호출 금지, `practice/feedback` 라우트는 엔진 포워딩만 담당
- 하위 호환 — `InterviewChat`의 신규 props는 모두 optional, 기본값 `interviewMode='real'`
- 상태 머신 — `practiceStep('idle'→'feedback'→'retry'→'done')`으로 연습 플로우 관리

### 핵심 고민 포인트

**1. interviewMode 전달 및 유지 방법**
`InterviewSession` DB에 저장하고, 페이지 간 이동은 URL 쿼리 파라미터(`?interviewMode=practice`)로 전달한다.
session API는 DB에서 읽은 값을 응답에 포함하지만, 페이지는 URL param을 primary로 사용한다.

**2. practiceStep 상태 설계**
피드백 표시 중(`'feedback'`)에는 `AnswerInput`이 숨겨지기 때문에, 재답변 여부 판단을 `practiceStep === 'feedback'`으로 체크하면 함수 자체가 호출되지 않는다. 반드시 `practiceStep === 'retry'`로 판단해야 한다.

**3. "다음 질문" 처리**
연습 모드에서 "다음 질문"은 피드백 흐름과 무관하게 `/api/interview/answer`를 호출하는 기존 실전 로직을 재사용한다. 호출 전 `practiceStep`, `practiceFeedback`, `currentAnswer`를 리셋한다.

**4. timeout 설정**
엔진 내부 LLM timeout이 30s이므로 서비스 fetch timeout은 `AbortSignal.timeout(40_000)` (40s)로 설정한다.
Vercel function 기본 한도 초과를 막기 위해 `maxDuration = 45` 명시.

---

## 단계별 구현 순서

### Step 1: 타입 정의 — `lib/types.ts`

**변경 내용:**

```typescript
// 추가할 타입
export type FeedbackDetail = {
  good: string[]
  improve: string[]
}

export type ComparisonDelta = {
  scoreDelta: number
  improvements: string[]
}

export type PracticeFeedbackRequest = {
  question: string
  answer: string
  previousAnswer?: string
}

export type PracticeFeedbackResponse = {
  score: number
  feedback: FeedbackDetail
  keywords: string[]
  improvedAnswerGuide: string
  comparisonDelta?: ComparisonDelta | null
}
```

**수정할 기존 타입:**
```typescript
// InterviewStartRequest.interviewMode 확장
interviewMode?: 'real' | 'practice'  // 기존: interviewMode?: 'real'
```

---

### Step 2: Prisma 스키마 + 마이그레이션

**`prisma/schema.prisma` 수정:**
```prisma
model InterviewSession {
  ...
  interviewMode       String   @default("real")   // ← 추가
  ...
}
```

**마이그레이션 실행:**
```bash
cd services/seung
npx prisma migrate dev --name add_interview_mode
```

> 주의: `DIRECT_URL`(port 5432) 필요. `.env.local` 확인 후 실행.

---

### Step 3: 기존 테스트 mock 수정 (회귀 방지)

Prisma 스키마 변경으로 `interviewSession.findUnique` mock 반환 객체에 `interviewMode` 필드가 없으면 Prisma Client 타입 추론 불일치 가능.

**`tests/api/interview-answer.test.ts`:**
```typescript
const mockSession = {
  ...
  interviewMode: 'real',  // ← 추가
}
```

**`tests/api/report-generate.test.ts`:**
```typescript
const mockSession = {
  ...
  interviewMode: 'real',  // ← 추가
}
```

**`tests/api/interview-start.test.ts`:**
- `create` mock은 `{ id: 'session-123' }` 반환 — 변경 불필요
- `interviewMode` 저장 검증 테스트 케이스 추가 (Step 5에서 함께)

---

### Step 4: `POST /api/practice/feedback` 라우트 TDD

**Red 단계 — 테스트 먼저 작성:** `tests/api/practice-feedback.test.ts`

테스트 케이스:
1. 성공 (첫 답변): `{ question, answer }` → 200, `{ score, feedback, keywords, improvedAnswerGuide, comparisonDelta: null }`
2. 성공 (재답변): `{ question, answer, previousAnswer }` → 200, `comparisonDelta` 포함
3. `question` 누락 → 400
4. `answer` 누락 → 400
5. `answer` 빈 문자열 → 400
6. `ENGINE_BASE_URL` 없음 → 500
7. 엔진 400 → 서비스 400 (에러 그대로 전달)
8. 엔진 500 → 서비스 500

**Green 단계 — 구현:** `src/app/api/practice/feedback/route.ts`

```
body 검증 (question, answer 필수, 빈 문자열 거절)
→ ENGINE_BASE_URL 확인
→ fetch(${engineUrl}/api/practice/feedback, { AbortSignal.timeout(40_000) })
→ 엔진 응답 상태코드 그대로, body JSON 그대로 반환
```

> 핵심: 엔진 400/500 → 서비스도 동일 상태코드로 전달 (report/generate와 달리 메시지 변환 없음)

---

### Step 5: `POST /api/interview/start` 수정

**`src/app/api/interview/start/route.ts`:**

```typescript
// body 타입 확장
let body: { resumeId?: string; mode?: string; personas?: PersonaType[]; interviewMode?: 'real' | 'practice' }

// DB 저장 시 interviewMode 포함
session = await prisma.interviewSession.create({
  data: {
    ...
    interviewMode: body.interviewMode ?? 'real',
  },
})
```

**`tests/api/interview-start.test.ts`에 추가:**
- `interviewMode: 'practice'` 전달 시 `create` 호출에 반영되는지 검증

---

### Step 6: `GET /api/interview/session` 수정

현재 `select`에 `interviewMode` 없음 → 응답에 포함 안 됨.

**`src/app/api/interview/session/route.ts` 수정:**
```typescript
// select에 추가
select: {
  ...
  interviewMode: true,  // ← 추가
}
// 로컬 타입에 추가
interviewMode: string

// 응답에 추가
return NextResponse.json({
  ...
  interviewMode: session.interviewMode,
})
```

> **모드 판단 전략**: URL query param(`?interviewMode=practice`)을 primary로 사용.
> session API의 `interviewMode`는 fallback 또는 서버사이드 검증용.
> Interview 페이지는 `searchParams.get('interviewMode')` → 없으면 `'real'` 기본값.

---

### Step 7: `/resume` 페이지 — 모드 선택 UI

**`src/app/resume/page.tsx` 수정:**

현재: "면접 시작" 버튼 클릭 → 바로 API 호출

변경 후:
```
"면접 시작" 클릭
  → showModeSelect: true (모드 선택 UI 표시)
  → 실전 모드 / 연습 모드 버튼 표시

모드 선택 클릭
  → POST /api/interview/start { resumeId, interviewMode: 'real' | 'practice' }
  → 성공 시: router.push(`/interview?sessionId=${data.sessionId}&interviewMode=${interviewMode}`)
```

**새 상태:**
```typescript
const [showModeSelect, setShowModeSelect] = useState(false)
```

**UI 설계:**
```
[면접 시작] 버튼 클릭 →

┌─────────────────────────────────────┐
│  면접 모드를 선택해주세요            │
│                                     │
│  [실전 모드]        [연습 모드]     │
│  답변 제출 후       답변 직후 피드백 │
│  다음 질문으로 이동 + 재답변 가능   │
└─────────────────────────────────────┘
```

---

### Step 8: `/interview` 페이지 — practice 상태 추가

**`src/app/interview/page.tsx` 수정:**

**새 상태:**
```typescript
const [interviewMode, setInterviewMode] = useState<'real' | 'practice'>('real')
const [practiceStep, setPracticeStep] = useState<'idle' | 'feedback' | 'retry' | 'done'>('idle')
const [currentAnswer, setCurrentAnswer] = useState<string>('')
const [practiceFeedback, setPracticeFeedback] = useState<PracticeFeedbackResponse | null>(null)
const [practiceSubmitting, setPracticeSubmitting] = useState(false)
```

**초기화 (useEffect):**
```typescript
// URL params에서 interviewMode 읽기
const mode = searchParams.get('interviewMode')
if (mode === 'practice') setInterviewMode('practice')
```

**`handleSubmit` 분기:**
```typescript
const handleSubmit = async (answer: string) => {
  if (interviewMode === 'practice') {
    await handlePracticeFeedback(answer)
  } else {
    await handleRealAnswer(answer)  // 기존 로직
  }
}
```

**`handlePracticeFeedback`:**
```typescript
const handlePracticeFeedback = async (answer: string) => {
  const isRetry = practiceStep === 'retry'  // 재답변인지 확인 ('feedback' 단계엔 AnswerInput이 숨겨져 호출 불가)
  const currentQuestion = /* 현재 마지막 질문 메시지에서 추출 */

  setPracticeSubmitting(true)
  setMessages(prev => [...prev, { id: nextMsgId(), type: 'answer', text: answer }])

  const body: PracticeFeedbackRequest = {
    question: currentQuestion,
    answer,
    ...(isRetry ? { previousAnswer: currentAnswer } : {}),
  }

  const res = await fetch('/api/practice/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()

  if (!res.ok) { /* 에러 처리 */ return }

  setPracticeFeedback(data)
  if (isRetry) {
    setPracticeStep('done')
  } else {
    setCurrentAnswer(answer)
    setPracticeStep('feedback')
  }
  setPracticeSubmitting(false)
}
```

**`handleNextQuestion` (practice → real answer 진행):**
```typescript
const handleNextQuestion = async () => {
  const finalAnswer = practiceStep === 'done'
    ? /* 마지막 메시지의 answer */
    : currentAnswer
  // 상태 초기화
  setPracticeStep('idle')
  setPracticeFeedback(null)
  setCurrentAnswer('')
  // 실전 answer API 호출
  await handleRealAnswer(finalAnswer)
}
```

**`AnswerInput` 숨김 조건 수정:**
```typescript
hidden={sessionComplete || (interviewMode === 'practice' && practiceStep === 'feedback')}
// 피드백 표시 중에는 AnswerInput 숨김
// practiceStep === 'done' (재답변 완료 후)에도 숨김
```

---

### Step 9: `InterviewChat` 컴포넌트 — practice UI 추가

**Props 확장:**
```typescript
type Props = {
  messages: Message[]
  sessionComplete: boolean
  onRestart?: () => void
  onReport?: () => void
  isGeneratingReport?: boolean
  // 이하 신규 (기본값으로 하위 호환 유지)
  interviewMode?: 'real' | 'practice'   // default: 'real'
  practiceFeedback?: PracticeFeedbackResponse | null
  practiceStep?: 'idle' | 'feedback' | 'retry' | 'done'
  onRetry?: () => void
  onNextQuestion?: () => void
  practiceSubmitting?: boolean
}
```

**렌더링 로직 추가:**

마지막 answer 메시지 직후에 practice 피드백 블록 조건부 렌더링:

```
피드백 블록 (practiceStep === 'feedback' || 'done'):
  ┌──────────────────────────────────────────────┐
  │  점수: 78점                                  │
  │                                              │
  │  잘한 점 ✓                                   │
  │  • 구체적인 사례를 제시했습니다              │
  │                                              │
  │  개선할 점 △                                 │
  │  • 결론을 먼저 말하면 더 명확합니다          │
  │                                              │
  │  키워드: #리더십 #문제해결 #소통             │
  │                                              │
  │  개선 가이드: "결론→이유→사례" 구조로...     │
  └──────────────────────────────────────────────┘

  comparisonDelta (practiceStep === 'done'):
  ┌──────────────────────────────────────────────┐
  │  향상도: +12점 (66 → 78)                    │
  │  • 결론을 먼저 제시했습니다                  │
  │  • 키워드 사용이 자연스러워졌습니다          │
  └──────────────────────────────────────────────┘

  버튼:
  - practiceStep === 'feedback': [다시 답변하기] [다음 질문]
  - practiceStep === 'done':     [다음 질문]
```

> **하위 호환**: `interviewMode` prop이 없거나 `'real'`이면 기존 UI 그대로.
> 기존 `InterviewChat` 테스트 7개 모두 변경 없이 통과해야 함.

---

### Step 10: Vitest 단위 테스트 추가

**`tests/api/practice-feedback.test.ts`** — Step 4에서 작성 (8개 케이스)

**`tests/components/InterviewChat.test.tsx`** — practice 관련 케이스 추가:
1. `interviewMode='practice'`, `practiceStep='feedback'` → 피드백 블록 표시
2. `onRetry` 버튼 클릭 → `onRetry` 호출
3. `practiceStep='done'`, `comparisonDelta` 있음 → comparisonDelta 표시
4. `interviewMode='real'` (기본값) → 피드백 블록 없음 (기존 동작 유지)

---

### Step 11: Playwright E2E 테스트

**`tests/e2e/practice-flow.spec.ts`:**

```typescript
test.setTimeout(120_000)

test.describe('연습 모드 플로우', () => {
  // 공통 mock: session, questions, interview/start, interview/answer
  // practice/feedback mock 별도

  test('연습 모드 선택 → 첫 질문 표시', ...)
  test('답변 제출 → 피드백 블록 표시 (score, good, improve, keywords)', ...)
  test('"다시 답변하기" → 재답변 → comparisonDelta 표시', ...)
  test('"다음 질문" → /api/interview/answer 호출 → 다음 질문 표시', ...)
})
```

Mock 데이터:
```typescript
const MOCK_PRACTICE_FEEDBACK = {
  score: 72,
  feedback: {
    good: ['구체적인 경험을 제시했습니다.'],
    improve: ['결론을 먼저 말하면 더 효과적입니다.'],
  },
  keywords: ['리더십', '협업'],
  improvedAnswerGuide: '결론 → 이유 → 사례 순서로 답변해 보세요.',
  comparisonDelta: null,
}

const MOCK_PRACTICE_FEEDBACK_RETRY = {
  ...MOCK_PRACTICE_FEEDBACK,
  score: 84,
  comparisonDelta: {
    scoreDelta: 12,
    improvements: ['결론을 먼저 제시했습니다.'],
  },
}
```

---

### Step 12: `.ai.md` 최신화

`services/seung/.ai.md` 수정:
- `Phase 3: practice 모드` → `[x]` 체크
- 구조 섹션: 신규 파일 추가
  - `api/practice/feedback/route.ts`
  - `tests/api/practice-feedback.test.ts`
  - `tests/e2e/practice-flow.spec.ts`
- 진행 상태 업데이트

---

## 구현 순서 요약

```
1. lib/types.ts 타입 추가
2. prisma/schema.prisma 수정 + migrate dev
3. 기존 테스트 mock 수정 (interviewMode 필드)
4. practice/feedback 라우트 TDD (테스트 → 구현)
5. interview/start 수정 + 테스트 추가
6. interview/session route 확인·수정
7. resume/page.tsx 모드 선택 UI
8. interview/page.tsx practice 상태·핸들러
9. InterviewChat.tsx practice 피드백 블록
10. InterviewChat 컴포넌트 테스트 추가
11. Playwright E2E 작성
12. 전체 테스트 통과 확인 (vitest run + playwright)
13. .ai.md 최신화
```

---

---

### 리스크 및 완화

| 리스크 | 완화 방법 |
|--------|----------|
| LLM 응답 지연 (최대 30s) | `maxDuration=45`, `AbortSignal.timeout(40_000)` |
| `practiceStep` 오판정 | `'feedback'` 단계에서 AnswerInput 숨김 → `isRetry`는 반드시 `practiceStep === 'retry'`로 판단 |
| Prisma 스키마 변경으로 기존 mock 불일치 | `interview-answer`, `report-generate` 테스트 mock에 `interviewMode: 'real'` 추가 |
| `migrate dev` 실패 | Prisma는 `.env`만 읽음 — `.env.local` 내용을 `.env`로 복사 후 실행 |
| `InterviewChat` 기존 테스트 회귀 | 신규 props 모두 optional, 기본값 `interviewMode='real'`로 하위 호환 유지 |
