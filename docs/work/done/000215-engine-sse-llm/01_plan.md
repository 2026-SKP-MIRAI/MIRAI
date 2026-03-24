# [#215] feat: [engine] SSE 스트리밍 — 일반 면접 LLM 응답 실시간 스트리밍 (체감 속도 개선) — 구현 계획

> 작성: 2026-03-24

---

## 완료 기준

**Phase 1: SSE 스트리밍 기반 구현**
- [x] `engine/app/routers/interview.py` — `?stream=true` 쿼리 파라미터 추가, 기본값 false(하위 호환 유지)
- [x] `engine/app/services/interview_service.py` — LLM `stream=True`, token·done 이벤트 yield
- [x] **siw** `interview-service.ts` — 재시도 기준 스트림 연결 실패로 재설계
- [x] **siw** `answer/route.ts` — tee() 드레인 패턴, done 이벤트 DB 업데이트
- [x] **siw** 클라이언트 컴포넌트 — done 세션 상태 업데이트
- [x] 테스트: 엔진 pytest (12개) + siw vitest (13개)

**Phase 2: 스트리밍 UX 개선 + 연습모드 대응**
- [x] 채팅 순서 고정 (내 답변 먼저, 그 아래 다음 질문 스트리밍)
- [x] 스트리밍 대기 스피너 "질문 생성 중..."
- [x] 스트리밍 속도 0.07초/단어
- [x] meta 이벤트로 페르소나 라벨 실시간 전달
- [x] Path C JSON 노출 버그 수정 (silent 수집 후 question만 스트리밍)
- [x] Path B 꼬리질문 단어 단위 스트리밍
- [x] 연습모드 전체 UX 동기화 (스피너, 재답변, 피드백 유지)

---

## 구현 계획

> ralplan consensus 완료 (Planner → Architect → Critic APPROVE) | 2026-03-24

---

### Principles (설계 원칙)

1. **하위 호환 우선**: `?stream=true` opt-in. 기본값 false. 기존 `call_llm()`, `process_answer()` 함수 변경 없음.
2. **동기/비동기 이원 체계**: 기존 동기 `OpenAI` 클라이언트 유지 + 스트리밍 전용 `AsyncOpenAI` 별도 추가.
3. **스트리밍은 2번째 LLM만**: 1번째 LLM(꼬리질문 판단)은 JSON 파싱 필수 → streaming 불필요.
4. **done 이벤트에 전체 페이로드**: DB 업데이트/상태 전이는 반드시 done 이벤트 기준.
5. **엔진 stateless 불변식 유지**: 엔진은 세션/DB 없음. 서비스가 done 페이로드로 DB 업데이트.
6. **graceful degradation**: SSE 연결 끊김 → 서비스 재시도 or fallback. 클라이언트 에러 표시.

---

### Options

- **Option A (채택)**: 엔진 SSE → 서비스 패스스루 → 클라이언트. 최소 지연, 표준 SSE 프로토콜.
- **Option B (기각)**: 서비스에서 SSE 재생성 — 이중 버퍼링으로 TTFB 이점 감소.
- **Option C (기각)**: 가짜 스트리밍 — TTFB 개선 0, 이슈 목표 달성 불가.

---

### Step 0: AsyncOpenAI 클라이언트 추가 (`llm_client.py`)

**변경 파일**: `engine/app/services/llm_client.py`

```python
from openai import AsyncOpenAI  # 추가

_async_client: AsyncOpenAI | None = None

def _get_async_client() -> AsyncOpenAI:
    global _async_client
    if _async_client is None:
        _async_client = AsyncOpenAI(
            base_url=OPENROUTER_BASE_URL,
            api_key=settings.openrouter_api_key,
        )
    return _async_client
```

기존 `OpenAI` / `call_llm()` / `parse_object()` 변경 없음.

**AC**:
- `_get_async_client()` 호출 시 `AsyncOpenAI` 인스턴스 반환
- 기존 `call_llm()` pytest 테스트 전체 통과

---

### Step 1: `call_llm_stream()` async generator (`llm_client.py`)

**변경 파일**: `engine/app/services/llm_client.py`

```python
async def call_llm_stream(
    prompt: str,
    *,
    model: str | None = None,
    timeout: float = 30.0,
    max_tokens: int = 2048,
    error_message: str = "처리 중 오류가 발생했습니다.",
) -> AsyncGenerator[str, None]:
    client = _get_async_client()
    resolved_model = model or settings.openrouter_model
    try:
        stream = await client.chat.completions.create(
            model=resolved_model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
            timeout=timeout,
            stream=True,
            stream_options={"include_usage": True},
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except LLMError:
        raise
    except Exception as e:
        raise LLMError(error_message) from e
```

**주의**: `stream_options={"include_usage": True}` — OpenRouter 지원 여부 불확실, 미지원 시 usage=None 허용.

**AC**:
- mock AsyncOpenAI로 3개 chunk yield 시 정확히 3번 yield
- LLM 에러 시 `LLMError` raise
- 기존 `call_llm()` 테스트 regression 없음

---

### Step 2: `process_answer_stream()` — 3개 분기 경로 (`interview_service.py`)

**변경 파일**: `engine/app/services/interview_service.py`

**3개 분기 경로 (CRITICAL)**:

#### Path A: 턴 제한 또는 큐 비어있음 → 즉시 done
```python
if len(history) + 1 >= MAX_TURNS or not questionsQueue:
    yield _sse_done(nextQuestion=None, updatedQueue=[], sessionComplete=True)
    return
```
- token 이벤트: **0개** / done(sessionComplete=True) / LLM 호출: 없음

#### Path B: `shouldFollowUp=True` → 꼬리질문 done만
```python
followup_data, _, _ = await asyncio.to_thread(_check_followup, ...)
if followup_data["shouldFollowUp"]:
    yield _sse_done(nextQuestion=QuestionWithPersona(question=followup_data["followupQuestion"], ...), ...)
    return
```
- token 이벤트: **0개** / done(followupQuestion) / LLM #1만 (asyncio.to_thread 래핑)

#### Path C: `shouldFollowUp=False` → 다음 질문 스트리밍
```python
collected_text = ""
async for token in call_llm_stream(prompt, ...):
    collected_text += token
    yield _sse_token(token)
data = parse_object(collected_text, required_keys=["question"])
yield _sse_done(nextQuestion=QuestionWithPersona(question=data["question"], ...), ...)
```
- token 이벤트: **N개** + done(nextQuestion) / LLM #1(동기) + LLM #2(스트리밍)

**헬퍼 함수**:
```python
def _sse_token(text: str) -> str:
    return f"data: {json.dumps({'type': 'token', 'text': text}, ensure_ascii=False)}\n\n"

def _sse_done(**payload) -> str:
    return f"data: {json.dumps({'type': 'done', ...}, ensure_ascii=False)}\n\n"

def _sse_error(message: str) -> str:
    return f"data: {json.dumps({'type': 'error', 'message': message}, ensure_ascii=False)}\n\n"
```

기존 `process_answer()` 변경 없음.

**AC**:
- Path A: token 0개 + done(sessionComplete=True) 1개
- Path B: token 0개 + done(followupQuestion 포함) 1개
- Path C: token N개 + done(nextQuestion 포함) 1개
- 마지막 yield가 반드시 `type:done` 또는 `type:error`
- Path C 스트리밍 에러 시 `type:error` yield

---

### Step 3: `?stream=true` 라우터 (`interview.py`)

**변경 파일**: `engine/app/routers/interview.py`

```python
from fastapi import Query
from fastapi.responses import StreamingResponse
from app.services.interview_service import process_answer_stream

@router.post("/answer")
async def answer(req: InterviewAnswerRequest, stream: bool = Query(False)):
    if not stream:
        data, usage = process_answer(...)  # 기존 경로 변경 없음
        data.usage = usage
        return data

    async def event_generator():
        try:
            async for event in process_answer_stream(...):
                yield event
        except Exception:
            yield _sse_error("면접 진행 중 오류가 발생했습니다.")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
```

**AC**:
- `?stream=true` → Content-Type `text/event-stream`
- `?stream=false` 또는 미지정 → 기존 JSON 동일 응답
- TTFB < 1s (mock LLM, 100ms chunk 간격 기준)

---

### Step 4: siw SSE 마이그레이션

| 서비스 | 파일 | 비고 |
|--------|------|------|
| **siw** | `src/lib/interview/interview-service.ts` | answerStream(), SSE 연결 실패만 재시도 |
| **siw** | `src/app/api/interview/answer/route.ts` | **드레인 패턴 필수** |
| **siw** | `src/lib/sse-utils.ts` | parseSSELine, parseSSEStream |
| **siw** | `src/app/(app)/interview/[sessionId]/page.tsx` | done 이벤트 파싱 |

#### siw 드레인 패턴 (CRITICAL — engineResultCache 보호)

```typescript
const [drainStream, clientStream] = engineResponse.body!.tee();

// drain task — 클라이언트 disconn 무관하게 done까지 완주
const drainPromise = (async () => {
  for await (const event of parseSSEStream(drainStream)) {
    if (event.type === 'done') {
      await interviewRepository.saveEngineResult(sessionId, event.data);
      await interviewRepository.updateAfterAnswer(sessionId, { ...event.data, engineResultCache: null });
    }
  }
})();

const responseStream = new ReadableStream({
  async start(controller) {
    try {
      for await (const event of parseSSEStream(clientStream)) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
    } catch { /* 클라이언트 disconn — drain은 계속 진행 */ }
    controller.close();
  }
});

await drainPromise;  // route handler 종료 전 drain 완료 대기
return new Response(responseStream, { headers: { 'Content-Type': 'text/event-stream' } });
```

**백프레셔 주의**: `tee()` 내부 버퍼링은 `max_tokens=2048` (~8KB) 이하로 제한되어 허용 범위.

**AC**:
- vitest: route handler `text/event-stream` Content-Type 반환
- vitest: done 이벤트 시 DB 업데이트 확인
- vitest (siw): 클라이언트 disconn 후에도 drain task 완료 + cache 저장 확인
- vitest (siw): engineResultCache 존재 시 스트리밍 없이 done 이벤트만 반환

---

### Step 5: 클라이언트 컴포넌트 토큰 렌더링

**공통 변경 패턴**:
1. `fetch('/api/interview/answer')` 후 `response.body` ReadableStream 소비
2. 상태 머신: `idle → submitting → streaming → idle`
3. `token` 이벤트 → 질문 텍스트 append
4. **token 0개 스트림 (Path A/B) 정상 처리** — done만으로 상태 전이
5. `done` 이벤트 → 최종 질문으로 교체, sessionComplete 업데이트
6. `error` 이벤트 또는 비정상 종료 → 에러 메시지 + 재시도 버튼
7. 페이지 이탈 시 `AbortController.abort()` 정리

**주의**: `EventSource` API POST 미지원 → `fetch` + ReadableStream 수동 파싱.

**AC**:
- 토큰 한 글자씩 렌더링, done 후 최종 질문 표시
- token 0개 스트림에서도 정상 상태 전이

---

### Step 6: 테스트

| 영역 | 파일 | 테스트 내용 |
|------|------|-------------|
| 엔진 unit | `tests/unit/services/test_llm_client_stream.py` | `call_llm_stream` mock 동작 |
| 엔진 unit | `tests/unit/services/test_interview_service_stream.py` | Path A/B/C 3분기 |
| 엔진 integration | `tests/integration/test_interview_router_stream.py` | SSE 형식, 하위 호환 |
| siw vitest | `src/lib/interview/__tests__/interview-service-stream.test.ts` | answerStream, 재시도, 캐시 |
| siw vitest | `src/app/api/interview/answer/__tests__/route.test.ts` | 드레인 패턴, DB 업데이트 |

---

### SSE Protocol Spec

```
# 토큰 이벤트 (0회 이상 — Path A/B는 0개)
data: {"type":"token","text":"다음으로 "}\n\n

# done 이벤트 (정확히 1회, 마지막)
data: {"type":"done","nextQuestion":{"persona":"tech_lead","personaLabel":"기술팀장","question":"...","type":"main"},"updatedQueue":[...],"sessionComplete":false}\n\n

# 에러 이벤트 (done 대신 전송)
data: {"type":"error","message":"면접 진행 중 오류가 발생했습니다."}\n\n
```

**불변식**:
- 모든 SSE 스트림은 반드시 `done` 또는 `error`로 종료
- `done` 페이로드는 `InterviewAnswerResponse` 스키마와 동일 구조
- 클라이언트는 token 0개인 스트림도 정상 처리

---

### 구현 결과 (2026-03-24)

| 단계 | 상태 | 비고 |
|------|------|------|
| Step 0: AsyncOpenAI | ✅ 완료 | `_get_async_client()` lazy init |
| Step 1: call_llm_stream | ✅ 완료 | async generator, stream_options 포함 |
| Step 2: process_answer_stream | ✅ 완료 | Path A/B/C + _sse_token/error/done 헬퍼 |
| Step 3: ?stream=true 라우터 | ✅ 완료 | StreamingResponse + SSE 헤더 |
| Step 4: siw SSE 마이그레이션 | ✅ 완료 | 드레인 패턴 버그 수정 포함 |
| Step 5: 클라이언트 done 이벤트 | ✅ 완료 | page.tsx parseSSEStream |
| Step 6: 테스트 | ✅ 완료 | pytest 12개 + vitest 13개 = 25개 PASS |

**버그 수정**: `route.ts` 드레인 패턴 — `await drainPromise`를 `return new Response` 이전 → `controller.close()` 이후로 이동 (스트리밍 효과 복원)

---

### Guardrails

**Must Have**:
- `?stream=false` 기본값 → 기존 JSON 100% 동일
- `call_llm()`, `process_answer()` 기존 동기 함수 변경 없음
- done 이벤트 페이로드 = InterviewAnswerResponse 스키마
- siw engineResultCache 드레인 패턴으로 disconnect 보호 유지

**Must NOT Have**:
- 기존 `call_llm()` async 변환 (하위 호환 파괴)
- 엔진에 세션/DB 로직 추가 (stateless 위반)
- `EventSource` API 사용 (POST 불가)
- 1번째 LLM 스트리밍 (JSON 파싱 필수)
- 서비스 간 공유 패키지 도입

---

## Phase 2 구현 계획 — 스트리밍 UX 개선 + 연습모드 대응

> 작성: 2026-03-24 | Phase 1 배포 후 UX 문제 발견으로 추가 구현

---

### 문제가 뭐였냐 (쉽게 설명)

Phase 1에서 스트리밍을 넣었는데, 실제로 써보니 이런 문제들이 생겼다.

**문제 1: 채팅 순서가 챗GPT랑 달랐다**

챗GPT에서 대화하면 이런 순서로 나온다:
```
나:  [내가 방금 보낸 메시지]
AI: [타이핑되듯 나오는 답변]
```

근데 우리 면접 앱은 이랬다:
```
면접관: [이전 질문]
                        ← 내 답변이 여기 없음! 화면이 비어있다가
면접관: [다음 질문이 갑자기 뜸]
```

왜 그랬냐면, 내 답변을 제출하면 서버 응답이 올 때까지 기다렸다가 이력(history)에 추가하기 때문이다. 서버 응답 오기 전까지는 내 답변이 화면에 없었던 것.

**문제 2: 스트리밍 중에 페르소나(담당자)가 "다음 질문"으로 표시됐다**

스트리밍이 시작될 때 "HR 담당자"인지 "기술팀장"인지 몰랐다. LLM이 만드는 텍스트를 먼저 받고, 그게 다 끝난 done 이벤트에 페르소나 정보가 들어있었기 때문. 스트리밍하는 동안은 페르소나를 알 수 없었다.

**문제 3: 스트리밍 중에 JSON 코드가 그대로 보였다**

Path C(다음 질문 생성)에서 LLM이 이런 형태로 답했다:
```json
{"question": "다음으로 본인의 강점을 말씀해주세요.", "personaLabel": "기술팀장"}
```

우리는 이걸 그대로 토큰 단위로 스트리밍했더니 화면에 `{"question": "다음으로 ...` 이런 식으로 보였다. 사용자한테는 당연히 JSON 코드가 보이면 안 된다.

**문제 4: 꼬리질문(Path B)은 스트리밍이 없었다**

Path B(꼬리질문)는 LLM이 이미 만들어놓은 질문을 done 이벤트에 담아서 한 번에 전달했다. 그래서 꼬리질문이 나올 때는 스트리밍 효과 없이 텍스트가 퍽 하고 등장했다.

**문제 5: 연습모드 버그들**

- 다시 답변하기 → 2번째 피드백 받아도 또 제출할 수 있었다 (버그)
- 다시 답변하기 눌렀을 때 피드백 카드가 사라졌다 (의도와 다름)
- 다음 질문으로 눌렀을 때 레이아웃이 깨졌다

---

### 해결 방법 (쉽게 설명)

#### 해결 1: pendingAnswer — "보낸 척"하기 (Optimistic Display)

서버 응답을 기다리지 않고, **답변을 제출하는 순간 바로 화면에 표시**한다.

```
사용자가 "답변 제출" 클릭
  → pendingAnswer = "제가 생각하는 강점은..."  (← 즉시 화면에 표시)
  → 서버에 요청 보내는 중...
  → 서버 응답 오면 history에 추가하고 pendingAnswer 초기화
```

이렇게 하면 사용자 입장에서는 내 답변이 바로 올라가는 것처럼 보인다.

```typescript
// page.tsx — handleSubmit에서
const submittedAnswer = answer;
setPendingAnswer(submittedAnswer);  // 즉시 화면에 표시
// ... fetch 요청 ...
// 완료 후
setHistory(prev => [...prev, { question: ..., answer: submittedAnswer, ... }]);
setPendingAnswer("");  // 이제 history에 들어갔으니 제거
```

#### 해결 2: meta 이벤트 — 스트리밍 전에 페르소나 먼저 알려주기

토큰이 오기 전에 먼저 "이 질문은 기술팀장이 할 거야"라는 정보를 보내는 새로운 이벤트 타입을 추가했다.

```
서버가 보내는 순서:
  1. meta 이벤트  → {"type": "meta", "persona": "tech_lead", "personaLabel": "기술팀장"}
  2. token 이벤트 → {"type": "token", "text": "다음으로 "}
  3. token 이벤트 → {"type": "token", "text": "본인의 "}
  4. done 이벤트  → {"type": "done", ...}
```

클라이언트는 meta 이벤트를 받는 순간 `streamingPersona` 상태를 업데이트하고, 스트리밍 버블에 "기술팀장"을 바로 표시한다.

```python
# interview_service.py — Path C에서
yield f"data: {json.dumps({'type': 'meta', 'persona': persona, 'personaLabel': next_persona_label})}\n\n"
# 그 다음에 token 이벤트들 yield
```

```typescript
// sse-utils.ts — SSEEvent 타입에 meta 추가
export type SSEEvent =
  | { type: 'token'; text: string }
  | { type: 'meta'; persona: string; personaLabel: string }  // 추가
  | { type: 'done'; ... }
  | { type: 'error'; ... }
```

#### 해결 3: Path C JSON silent 수집 — 전부 모은 다음 question만 스트리밍

LLM한테 JSON으로 답하라고 시켰으니, 그 JSON을 먼저 다 모아서 파싱한 다음, `question` 필드의 텍스트만 단어 단위로 스트리밍한다.

```python
# interview_service.py — Path C
# 전: LLM 토큰을 그대로 스트리밍 (JSON 노출)
# 후: 전부 모아서 파싱 후 question만 스트리밍

collected_text = ""
async for token in call_llm_stream(prompt, model=model):
    collected_text += token   # 일단 전부 저장

# LLM 응답이 비어있으면 오류
if not collected_text.strip():
    raise Exception("면접 질문 생성에 실패했습니다. 다시 시도해 주세요.")

# JSON 파싱
data = _parse_object(collected_text, required_keys=["question"])
question_text = data["question"]   # "다음으로 본인의 강점을..."

# question 텍스트만 단어 단위로 스트리밍
words = question_text.split()
for i, word in enumerate(words):
    token = word if i == 0 else " " + word
    yield _sse_token(token)
    await asyncio.sleep(0.07)   # 단어 사이 0.07초 딜레이
```

왜 이렇게 하면 되냐? LLM이 JSON을 완성한 뒤에 사용자한테는 그 안의 텍스트만 보여주면 되기 때문이다. TTFB(첫 글자까지 걸리는 시간)가 약간 늘지만, 화면에 JSON 코드가 보이는 것보다 훨씬 낫다.

#### 해결 4: Path B 꼬리질문도 단어 단위 스트리밍

꼬리질문은 done 이벤트에 이미 `followupQuestion` 텍스트가 있다. 그걸 그대로 단어로 쪼개서 스트리밍하면 된다.

```python
# Path B — 기존: yield _sse_done(followupQuestion)만
# 변경: meta → tokens → done 순서로

yield f"data: {json.dumps({'type': 'meta', 'persona': currentPersona, ...})}\n\n"
followup_question = followup_data.get("followupQuestion", "")
words = followup_question.split()
for i, word in enumerate(words):
    token = word if i == 0 else " " + word
    yield _sse_token(token)
    await asyncio.sleep(0.07)
yield _sse_done(InterviewAnswerResponse(nextQuestion=..., ...))
```

#### 해결 5: retryInputVisible — 재답변 상태를 두 가지로 분리

기존에는 `isRetried` 하나로 "재답변 중인가"를 관리했다. 이걸 둘로 나눴다.

| 상태 | 의미 |
|------|------|
| `isRetried` | 재답변 시도 여부 (한 번 true가 되면 비교 점수 계산에 쓰임) |
| `retryInputVisible` | 지금 재입력창이 보여야 하는가 |

```typescript
// 다시 답변하기 클릭
function handleRetry() {
  setIsRetried(true);          // 재답변 시도 기록
  setRetryInputVisible(true);  // 입력창 표시
  // setPracticeFeedback(null) 제거! — 피드백 카드 유지
}

// 2번째 피드백 수신 완료
if (isRetried) {
  setRetryInputVisible(false);  // 입력창 숨김 — 더 이상 제출 불가
}

// 다음 질문으로 클릭
async function handleNextQuestion() {
  setPracticeFeedback(null);    // 즉시 피드백 초기화
  setRetryInputVisible(false);  // 입력창 숨김
  setPendingAnswer(lastAnswer); // lastAnswer를 optimistic 표시
  // ... 서버 요청 ...
}
```

입력창 표시 조건도 명확해졌다:
```tsx
{/* 입력창: 세션 완료 아니고 (피드백 없거나 재입력 중일 때) */}
{!sessionComplete && (!practiceFeedback || retryInputVisible) && (
  <textarea ... />
)}
```

#### 해결 6: InterviewChat.tsx 렌더링 순서 재설계

채팅 버블이 화면에 나타나는 순서를 정확하게 정했다:

```
1. 이전 Q&A 히스토리 (모든 지난 질문과 내 답변들)
2. 현재 질문 버블 (항상 표시 — 스트리밍 중에도 유지)
3. 내 답변 버블 (pendingAnswer — 제출 즉시 표시)
4. 피드백 생성 중... 스피너 (연습모드, isFetchingFeedback=true)
5. 질문 생성 중... 스피너 (pendingAnswer있고 streamingText없고 isFetchingFeedback없을 때)
6. 스트리밍 버블 (streamingText — 타이핑 중인 다음 질문)
7. 면접 완료 메시지 (sessionComplete)
8. 연습모드 내 답변 + 피드백 카드
```

기존에는 currentQuestion 버블이 `!streamingText && currentQuestion` 조건으로 스트리밍 중에 사라졌다. 이걸 그냥 `currentQuestion`으로 바꿔서 항상 표시하도록 했다. 스트리밍 버블과 currentQuestion 버블이 동시에 보여도 문제없다 — 스트리밍 완료 후 currentQuestion이 다음 질문으로 업데이트되면서 스트리밍 버블이 사라진다.

---

### 구현 결과 요약 (Phase 2)

| 개선 항목 | 변경 파일 | 핵심 변경 |
|-----------|-----------|----------|
| 채팅 순서 고정 | `page.tsx`, `InterviewChat.tsx` | pendingAnswer state 추가, currentQuestion 항상 표시 |
| 페르소나 라벨 | `interview_service.py`, `sse-utils.ts`, `page.tsx`, `InterviewChat.tsx` | meta 이벤트 타입 추가 |
| JSON 노출 수정 | `interview_service.py` | Path C silent 수집 후 question만 스트리밍 |
| Path B 스트리밍 | `interview_service.py` | 꼬리질문 단어 단위 스트리밍 |
| 스트리밍 속도 | `interview_service.py` | asyncio.sleep(0.04 → 0.07) |
| "질문 생성 중..." | `InterviewChat.tsx` | pendingAnswer && !streamingText && !isFetchingFeedback |
| "피드백 생성 중..." | `InterviewChat.tsx` | interviewMode === "practice" && isFetchingFeedback |
| 연습 재답변 버그 | `page.tsx` | retryInputVisible state 분리 |
| "다시 답변하기" UX | `page.tsx` | setPracticeFeedback(null) 제거, retryInputVisible=true |
| "다음 질문으로" UX | `page.tsx` | setPracticeFeedback(null)을 함수 시작부로 이동 |
