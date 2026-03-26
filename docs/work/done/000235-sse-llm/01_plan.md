# [#235] feat: [seung] SSE 스트리밍 — 면접 답변 LLM 응답 실시간 스트리밍 (체감 속도 개선) — 구현 계획

> 작성: 2026-03-25

---

## 완료 기준

- [x] `src/app/api/interview/answer/route.ts` — 엔진 fetch에 `?stream=true` 추가, SSE 스트림을 클라이언트로 패스스루, `done` 이벤트 수신 시 Supabase DB 업데이트 (기존 rate limiting / auth 로직 유지)
- [x] `src/app/interview/page.tsx` (또는 상위 컴포넌트) — SSE 스트림 파싱 로직 추가, `streamingText` / `streamingPersona` 상태 관리
- [x] `src/components/InterviewChat.tsx` — `streamingText` / `streamingPersona` prop 추가, 스트리밍 중 실시간 텍스트 버블 렌더링
- [x] 테스트: route.ts vitest + InterviewChat 컴포넌트 테스트 (SSE mock 처리)

---

## 코드 조사 결과 — 발견된 문제들

### 🔴 CRITICAL

| # | 문제 | 영향 |
|---|------|------|
| C-1 | `InterviewChat.tsx`가 `currentQuestion+history` 모델로 교체됐으나 `page.tsx`와 `tests/components/InterviewChat.test.tsx`는 모두 `messages[]` 모델 사용 → **현재 모든 컴포넌트 테스트 실패, 화면 렌더링 안 됨** | InterviewChat 전면 재작성 필요 |
| C-2 | 현재 `InterviewChat.tsx`에서 `onReport`, `onRestart`, `isGeneratingReport` prop이 사라짐 — 테스트 17개 + `page.tsx` 의존 | 반드시 복원 |
| C-3 | 현재 `InterviewChat.tsx`가 `PracticeFeedback` 타입 import — `types.ts`에 없음 (실제 타입은 `PracticeFeedbackResponse`) | 타입 에러 |
| C-4 | 현재 `InterviewChat.tsx`가 `isRetried` 사용 — 테스트/page는 `practiceStep` 사용 | prop 불일치 |
| C-5 | 현재 `InterviewChat.tsx`가 `onRetryAnswer` 사용 — 테스트/page는 `onRetry` 사용 | prop 불일치 |

### 🟡 MAJOR

| # | 문제 | 영향 |
|---|------|------|
| M-1 | `maxDuration = 35` — SSE 스트리밍 중 35초 초과 시 serverless function 강제 종료 | 응답 중단 위험 |
| M-2 | 테스트 파일이 이미 존재: `tests/api/interview-answer.test.ts` (11개), `tests/components/InterviewChat.test.tsx` (17개) — 신규 생성이 아닌 **기존 파일 업데이트** 필요 | 플랜 방향 변경 |
| M-3 | seung 테스트 위치가 `tests/` (siw는 `src/.../` __tests__) — 신규 테스트도 `tests/` 컨벤션 따라야 함 | 파일 경로 오류 |

### 🟢 MINOR

| # | 문제 | 영향 |
|---|------|------|
| m-1 | done 이벤트에서 `nextQuestion=null`일 때 `streamingText/streamingPersona` 초기화 명시 필요 | 스트리밍 버블 잔류 |
| m-2 | 엔진 `?stream=true` 지원 확인 완료: `stream: bool = Query(False)` — 이미 구현됨 | 영향 없음 (확인 완료) |
| m-3 | `sse-utils.ts` seung에 없음 — 신규 생성 필요 | (기존 플랜과 동일) |

---

## 수정된 구현 계획

### 핵심 전략 변경

> **InterviewChat.tsx를 `currentQuestion+history` 모델로 마이그레이션하지 않는다.**
> 기존 `messages[]` 모델을 유지하고 streaming props만 추가한다.
> — 이유: 테스트 17개 + page.tsx 전체가 `messages[]` 기반. 마이그레이션 비용 대비 이득 없음.

---

### 1단계: `services/seung/src/lib/sse-utils.ts` 생성

siw의 `sse-utils.ts`를 그대로 복사한다. 내용 동일.

```ts
export type SSEEvent =
  | { type: 'token'; text: string }
  | { type: 'meta'; persona: string; personaLabel: string }
  | { type: 'done'; nextQuestion: unknown; updatedQueue: unknown[]; sessionComplete: boolean }
  | { type: 'error'; message: string }

export function parseSSELine(line: string): SSEEvent | null
export async function* parseSSEStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent>
```

**변경 파일:** `services/seung/src/lib/sse-utils.ts` (신규)

---

### 2단계: `services/seung/src/lib/types.ts` 보완

InterviewChat에서 필요한 `InterviewMode` 타입만 추가한다.
`PracticeFeedback`은 추가하지 않음 — InterviewChat을 `PracticeFeedbackResponse`로 통일.

```ts
// 추가
export type InterviewMode = 'real' | 'practice'
```

**변경 파일:** `services/seung/src/lib/types.ts`

---

### 3단계: `services/seung/src/app/api/interview/answer/route.ts` 변경

#### 3-1. `maxDuration` 수정

```ts
// 변경 전
export const maxDuration = 35
// 변경 후
export const maxDuration = 60
```

#### 3-2. SSE 패스스루로 전환

**변경 전 흐름:**
```
auth → rate limit → session/resume 조회 → engine fetch → resp.json() → prisma.update → NextResponse.json(...)
```

**변경 후 흐름:**
```
auth → rate limit → session/resume 조회 → engine fetch(?stream=true)
  → body.tee() → [drainStream, clientStream]
  → drainPromise: parseSSEStream(drainStream), done 이벤트 → prisma.update (기존 로직 이동)
  → responseStream: parseSSEStream(clientStream) → re-encode → 패스스루
  → new Response(responseStream, { 'Content-Type': 'text/event-stream' })
```

**구체적 변경사항:**

1. 엔진 URL: `?stream=true` 추가
   ```ts
   engineResponse = await fetch(`${engineUrl}/api/interview/answer?stream=true`, { ... })
   ```

2. `engineResponse.ok` 체크 위치 변경: SSE 시작 전에 수행
   ```ts
   if (!engineResponse.ok || !engineResponse.body) {
     return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
   }
   ```

3. drainPromise 패턴 (기존 prisma.update 로직 이동):
   ```ts
   const [drainStream, clientStream] = engineResponse.body.tee()

   const drainPromise = (async () => {
     try {
       for await (const event of parseSSEStream(drainStream)) {
         if (event.type === 'done') {
           const doneEvent = event as Extract<SSEEvent, { type: 'done' }>
           const { nextQuestion, updatedQueue, sessionComplete } = doneEvent as {
             nextQuestion: { persona: PersonaType; personaLabel: string; question: string; type: QuestionType } | null
             updatedQueue: QueueItem[]
             sessionComplete: boolean
           }
           const newHistoryEntry: StoredHistoryEntry = {
             persona: session.currentPersona as HistoryItem['persona'],
             personaLabel: session.currentPersonaLabel,
             question: session.currentQuestion,
             answer: trimmedAnswer,
             questionType: session.currentQuestionType,
           }
           try {
             await prisma.interviewSession.update({
               where: { id: sessionId, sessionComplete: false, updatedAt: session.updatedAt },
               data: {
                 history: [...(session.history as StoredHistoryEntry[]), newHistoryEntry] as object[],
                 questionsQueue: updatedQueue as object[],
                 sessionComplete,
                 ...(nextQuestion ? {
                   currentQuestion: nextQuestion.question,
                   currentPersona: nextQuestion.persona,
                   currentPersonaLabel: nextQuestion.personaLabel,
                   currentQuestionType: nextQuestion.type,
                 } : {}),
               },
             })
           } catch (dbErr) {
             console.error('[interview/answer] drain DB 처리 실패:', dbErr)
           }
         }
       }
     } catch (err) {
       console.error('[interview/answer] drain stream 오류:', err)
     }
   })()
   ```

4. clientStream 패스스루:
   ```ts
   const encoder = new TextEncoder()
   const responseStream = new ReadableStream({
     async start(controller) {
       try {
         for await (const event of parseSSEStream(clientStream)) {
           controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
         }
       } catch {
         // 클라이언트 disconnect — drain은 계속
       }
       controller.close()
       await drainPromise
     },
   })

   return new Response(responseStream, {
     headers: {
       'Content-Type': 'text/event-stream',
       'Cache-Control': 'no-cache',
       'Connection': 'keep-alive',
     },
   })
   ```

5. 기존 `await engineResponse.json()` 블록 제거
6. 기존 `try { await prisma.interviewSession.update(...) }` 블록 제거 (drainPromise로 이동)
7. `return NextResponse.json({ nextQuestion, sessionComplete })` 제거

**유지되는 것:** auth 검증, rate limit, body 파싱, session/resume 조회, 타임아웃 에러 처리 (504)

**변경 파일:** `services/seung/src/app/api/interview/answer/route.ts`

---

### 4단계: `services/seung/src/components/InterviewChat.tsx` 재작성

현재 파일의 `currentQuestion+history` 모델을 **`messages[]` 모델로 되돌리고** streaming props를 추가한다.

#### Props 인터페이스 (목표)

```ts
type Message =
  | { id: string; type: 'question'; data: QuestionWithPersona }
  | { id: string; type: 'answer'; text: string }

type Props = {
  messages: Message[]
  sessionComplete: boolean
  onRestart?: () => void
  onReport?: () => void
  isGeneratingReport?: boolean
  // streaming
  streamingText?: string
  streamingPersona?: { persona: string; personaLabel: string } | null
  // practice 모드
  interviewMode?: InterviewMode
  practiceFeedback?: PracticeFeedbackResponse | null
  practiceStep?: 'idle' | 'feedback' | 'retry' | 'done'
  onRetry?: () => void
  onNextQuestion?: () => void
  practiceSubmitting?: boolean
}
```

#### 렌더링 추가: 스트리밍 버블

기존 messages 렌더링 아래에 추가:
```tsx
{/* 다음 질문 스트리밍 버블 */}
{!sessionComplete && streamingText && (() => {
  const persona = (streamingPersona?.persona ?? 'hr') as keyof typeof PERSONA_STYLE
  const style = PERSONA_STYLE[persona] ?? PERSONA_STYLE.hr
  const label = streamingPersona?.personaLabel ?? (PERSONA_LABELS[persona] ?? persona)
  return (
    <div
      data-testid="streaming-text"
      className={`rounded-2xl p-4 border ${style.bg} ${style.border}`}
    >
      <p className={`${style.nameColor} mb-2 text-sm`}>{label}</p>
      <p className="text-sm text-[#1F2937] leading-relaxed">
        {streamingText}
        <span className="inline-block w-0.5 h-3.5 bg-purple-500 ml-0.5 animate-pulse" />
      </p>
    </div>
  )
})()}

{/* 첫 토큰 대기 스피너 (답변 후 streamingText 없을 때) */}
{!sessionComplete && submitting && !streamingText && (
  <div className="rounded-2xl p-4 border bg-white border-purple-200">
    <div className="flex items-center gap-2">
      <span className="w-4 h-4 border-2 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
      <p className="text-sm text-[#9CA3AF]">질문 생성 중...</p>
    </div>
  </div>
)}
```

> 스피너는 page.tsx에서 `submitting` 상태를 prop으로 받을 수도 있고, streamingText만 있어도 충분. 단순하게 `streamingText`가 없을 때의 로딩 표시는 page.tsx에서 처리.

**변경 파일:** `services/seung/src/components/InterviewChat.tsx`

---

### 5단계: `services/seung/src/app/interview/page.tsx` 변경

#### 5-1. 스트리밍 상태 추가

```ts
const [streamingText, setStreamingText] = useState<string>('')
const [streamingPersona, setStreamingPersona] = useState<{ persona: string; personaLabel: string } | null>(null)
```

#### 5-2. `handleRealAnswer` SSE 전환

```ts
const handleRealAnswer = async (answer: string) => {
  if (submittingRef.current) return
  submittingRef.current = true
  setSubmitting(true)
  setSubmitError(null)

  // optimistic: 답변 즉시 messages에 추가
  setMessages((prev) => [...prev, { id: nextMsgId(), type: 'answer', text: answer }])

  try {
    const res = await fetch('/api/interview/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, answer }),
    })

    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}))
      setMessages((prev) => prev.slice(0, -1))  // optimistic 롤백
      setSubmitError(data?.error ?? '답변 제출에 실패했습니다. 다시 시도해 주세요.')
      return
    }

    for await (const event of parseSSEStream(res.body)) {
      if (event.type === 'token') {
        setStreamingText((prev) => prev + event.text)
      } else if (event.type === 'meta') {
        setStreamingPersona({ persona: event.persona, personaLabel: event.personaLabel })
      } else if (event.type === 'done') {
        const doneEvent = event as Extract<SSEEvent, { type: 'done' }>
        const nextQuestion = doneEvent.nextQuestion as QuestionWithPersona | null
        // streaming 상태 초기화
        setStreamingText('')
        setStreamingPersona(null)
        // 다음 질문 messages에 추가 또는 완료 처리
        if (nextQuestion) {
          setMessages((prev) => [...prev, { id: nextMsgId(), type: 'question', data: nextQuestion }])
        }
        if (doneEvent.sessionComplete) {
          setSessionComplete(true)
        }
      } else if (event.type === 'error') {
        setMessages((prev) => prev.slice(0, -1))  // optimistic 롤백
        setStreamingText('')
        setStreamingPersona(null)
        setSubmitError(event.message ?? '답변 처리 중 오류가 발생했습니다.')
      }
    }
  } catch {
    setMessages((prev) => prev.slice(0, -1))  // optimistic 롤백
    setStreamingText('')
    setStreamingPersona(null)
    setSubmitError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.')
  } finally {
    submittingRef.current = false
    setSubmitting(false)
  }
}
```

#### 5-3. InterviewChat props 업데이트

```tsx
<InterviewChat
  messages={messages}
  sessionComplete={sessionComplete}
  streamingText={streamingText}
  streamingPersona={streamingPersona}
  onRestart={handleRestart}
  onReport={handleReport}
  isGeneratingReport={isGeneratingReport}
  interviewMode={interviewMode}
  practiceFeedback={practiceFeedback}
  practiceStep={practiceStep}
  onRetry={handleRetry}
  onNextQuestion={handleNextQuestion}
  practiceSubmitting={practiceSubmitting}
/>
```

**변경 파일:** `services/seung/src/app/interview/page.tsx`

---

### 6단계: 테스트 업데이트 (신규 생성 아님)

#### 6-1. `tests/api/interview-answer.test.ts` 업데이트

기존 11개 테스트를 SSE 기반으로 전환.

**mock 패턴 변경:**
```ts
// 기존: JSON 응답 mock
mockFetch.mockResolvedValueOnce({ ok: true, json: async () => engineData })

// 변경: SSE 스트림 mock
function makeSSEStream(events: object[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const e of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
      controller.close()
    },
  })
}

mockFetch.mockResolvedValueOnce({
  ok: true,
  body: makeSSEStream([
    { type: 'token', text: '토큰' },
    { type: 'done', nextQuestion: {...}, updatedQueue: [], sessionComplete: false },
  ]),
})
```

**기존 테스트 검증 방식 변경:**
```ts
// 기존: JSON body 검증
const body = await response.json()
expect(body.nextQuestion.persona).toBe('tech_lead')

// 변경: SSE 응답 + DB 업데이트 검증
expect(response.status).toBe(200)
expect(response.headers.get('Content-Type')).toBe('text/event-stream')
const text = await response.text()
expect(text).toContain('"type":"done"')
// DB 업데이트 확인
expect(mockPrisma.interviewSession.update).toHaveBeenCalledWith(
  expect.objectContaining({ where: expect.objectContaining({ id: 'session-1' }) })
)
```

**유지되는 케이스 (에러 응답 형식 동일):**
- 401, 403, 400 (sessionId 누락), 400 (공백 답변), 404 (세션 없음), 400 (완료 세션), 504 (timeout), 500 (엔진 에러)

**추가 케이스:**
- SSE 스트림 패스스루 + done 이벤트 DB 업데이트 확인
- token 이벤트 0개 (done만) — sessionComplete=true
- 엔진 응답 `ok=false` → SSE 시작 전 500 반환
- 엔진 응답 body=null → 502 반환

#### 6-2. `tests/components/InterviewChat.test.tsx` 업데이트

기존 17개 테스트는 `messages[]` 모델 기반이므로 **전부 유지**.

**추가 케이스 (스트리밍):**
```tsx
it('streamingText prop이 있으면 스트리밍 버블이 렌더된다', () => {
  render(
    <InterviewChat
      messages={[]}
      sessionComplete={false}
      streamingText="질문이 생성"
      streamingPersona={{ persona: 'hr', personaLabel: 'HR 면접관' }}
    />
  )
  expect(screen.getByTestId('streaming-text')).toBeInTheDocument()
  expect(screen.getByText('HR 면접관')).toBeInTheDocument()
  expect(screen.getByText(/질문이 생성/)).toBeInTheDocument()
})

it('streamingText 없으면 스트리밍 버블이 없다', () => {
  render(<InterviewChat messages={[]} sessionComplete={false} />)
  expect(screen.queryByTestId('streaming-text')).not.toBeInTheDocument()
})

it('streamingPersona 없을 때 기본 레이블이 표시된다', () => {
  render(
    <InterviewChat
      messages={[]}
      sessionComplete={false}
      streamingText="질문 생성 중"
    />
  )
  expect(screen.getByTestId('streaming-text')).toBeInTheDocument()
})
```

**변경 파일:** `tests/api/interview-answer.test.ts`, `tests/components/InterviewChat.test.tsx`

---

### 7단계: `services/seung/.ai.md` 최신화

SSE 스트리밍 지원 내용 반영.

---

## 구현 순서

```
1단계 sse-utils.ts 신규    ─┐ 병렬
2단계 types.ts 수정        ─┘
       ↓
3단계 route.ts SSE 전환    ─┐ 병렬 (각각 독립)
4단계 InterviewChat.tsx    ─┤
5단계 page.tsx             ─┘
       ↓
6단계 테스트 업데이트
       ↓
7단계 .ai.md 최신화
```

---

## 최종 변경 파일 목록

| 파일 | 변경 유형 |
|------|-----------|
| `services/seung/src/lib/sse-utils.ts` | 신규 생성 |
| `services/seung/src/lib/types.ts` | 수정 (InterviewMode 추가) |
| `services/seung/src/app/api/interview/answer/route.ts` | 수정 (SSE 전환, maxDuration 60) |
| `services/seung/src/components/InterviewChat.tsx` | 수정 (messages[] 유지 + streaming props 추가) |
| `services/seung/src/app/interview/page.tsx` | 수정 (streaming 상태 + handleRealAnswer SSE 전환) |
| `services/seung/tests/api/interview-answer.test.ts` | 수정 (SSE mock으로 전환) |
| `services/seung/tests/components/InterviewChat.test.tsx` | 수정 (streaming 테스트 케이스 추가) |
| `services/seung/.ai.md` | 수정 (최신화) |
