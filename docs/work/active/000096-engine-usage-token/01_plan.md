# [#96] chore: [DE] engine 응답에 usage 메타데이터 추가 — token 사용량 기반 비용 추적 — 구현 계획

> 작성: 2026-03-19

---

## 완료 기준

- [ ] engine 각 API 응답 스키마에 `usage` 필드 추가
- [ ] `llm_client.py`의 `call_llm()`이 token usage를 반환에 포함
- [ ] 서비스 event-logger에서 token 수 → 비용 환산 로직 추가
- [ ] `llm_events_daily` 테이블에 `total_tokens`, `estimated_cost_usd` 컬럼 추가
- [ ] pytest: usage 필드 포함 응답 검증

---

## 구현 계획

### Step 1 — `engine/app/services/llm_client.py`

`call_llm()` 반환 타입을 `str` → `LLMResult` 로 변경.

```python
from dataclasses import dataclass

@dataclass
class UsageInfo:
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int

@dataclass
class LLMResult:
    content: str
    usage: UsageInfo | None
    model: str
```

- `response.usage` 파싱 후 `UsageInfo` 생성
- `usage`가 없는 경우(응답 없음 등) `None` 처리 — 하위 호환

---

### Step 2 — `engine/app/schemas.py`

`UsageMetadata` 모델 추가 및 각 Response 모델에 옵셔널 필드 삽입.

```python
class UsageMetadata(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    model: str
```

추가 대상 Response 모델 (모두 `usage: UsageMetadata | None = None`):
- `QuestionsResponse`
- `InterviewStartResponse`
- `InterviewAnswerResponse`
- `FollowupResponse`
- `ReportResponse`
- `PracticeFeedbackResponse`
- `ResumeFeedbackResponse`

> `ParseResponse`, `AnalyzeResponse`, `TargetRoleResponse` 는 LLM 직접 호출 없음 — 제외

---

### Step 3 — service 레이어 전파

**call_llm() 실제 호출부 전수 목록:**
- `engine/app/services/interview_service.py` — `from app.services.llm_client import call_llm as _call_llm` (**aliased import**, `_call_llm`로 검색 필요)
- `engine/app/services/llm_service.py` — `raw = call_llm(prompt, ...)` → **`parse_llm_response(raw)` 사용** (parse_object 아님)
- `engine/app/services/feedback_service.py` — `raw = call_llm(prompt, ...)`
- `engine/app/services/report_service.py`, `practice_service.py`, `role_service.py`

**패턴 A — parse_object 계열 (대부분의 service):**
```python
# 변경 전
raw = call_llm(prompt)
data = parse_object(raw, required_keys=[...])

# 변경 후
result = call_llm(prompt)
data = parse_object(result.content, required_keys=[...])
# 함수 반환: (parsed_data, result.usage)
```

**패턴 B — llm_service.py (parse_llm_response 계열):**
```python
# 변경 전
raw = call_llm(prompt, ...)
return parse_llm_response(raw)

# 변경 후
result = call_llm(prompt, ...)
questions = parse_llm_response(result.content)
return questions, result.usage  # 튜플 반환으로 변경
```

서비스 함수 반환 타입: `(result_data, UsageInfo | None)` 튜플로 통일.

---

### Step 4 — router 레이어 응답에 usage 주입

**수정 대상 router 전수:**
- `engine/app/routers/interview.py` — `/start`, `/answer`, `/followup` 3개 엔드포인트
- `engine/app/routers/resume.py` — `/questions`, `/feedback` 엔드포인트
- `engine/app/routers/report.py` — `/generate` 엔드포인트
- `engine/app/routers/practice.py` — `/feedback` 엔드포인트

현재 router는 서비스 결과를 **직접 return** 하는 패턴:
```python
# 현재 패턴 (interview.py:14)
return start_interview(req.resumeText, req.personas)
```

변경 후 usage 주입 패턴:
```python
# 변경 후
data, usage = interview_service.start_interview(req.resumeText, req.personas)
return InterviewStartResponse(**data, usage=usage)
```

> 모든 router가 동일 패턴 — service 반환이 튜플로 바뀌는 순간 일괄 수정 필수.

---

### Step 5 — `services/siw/src/lib/observability/event-logger.ts` (#95 수정)

**5-1. `LLMEvent` 인터페이스 필드 추가**
```ts
prompt_tokens?: number;
completion_tokens?: number;
model?: string;
```

**5-2. 비용 환산 함수 추가**
```ts
// OpenRouter 기준 모델별 단가 (USD per 1K tokens)
const MODEL_COST_PER_1K: Record<string, { input: number; output: number }> = {
  "google/gemini-2.5-flash": { input: 0.00015, output: 0.0006 },
};

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number
```

**5-3. `withEventLogging` 시그니처 변경**

engine 응답에서 usage를 꺼내어 이벤트에 포함할 수 있도록 콜백 반환 타입 확장.

```ts
// fn이 { data, usage? } 형태로 반환
export async function withEventLogging<T>(
  featureType: LLMEvent["feature_type"],
  sessionId: string | null,
  fn: (meta: LLMEventMeta) => Promise<{ data: T; usage?: EngineUsage }>,
): Promise<T>
```

이벤트 로그에 `prompt_tokens`, `completion_tokens`, `model` 포함.

---

### Step 6 — `llm_quality_dag.py` (#95 수정)

**6-1. `aggregate_metrics`** — token 합산 추가
```python
stats[ft]["sum_prompt_tokens"] += e.get("prompt_tokens", 0)
stats[ft]["sum_completion_tokens"] += e.get("completion_tokens", 0)
# result row에 total_tokens, estimated_cost_usd 추가
```

**6-2. `load_to_db`** — INSERT에 신규 컬럼 추가
```sql
INSERT INTO analytics.llm_events_daily
  (date, feature_type, call_count, avg_latency_ms, error_count, error_rate,
   total_tokens, estimated_cost_usd, updated_at)
...
ON CONFLICT ... DO UPDATE SET
  total_tokens = EXCLUDED.total_tokens,
  estimated_cost_usd = EXCLUDED.estimated_cost_usd,
  ...
```

---

### Step 7 — DB 마이그레이션

```sql
ALTER TABLE analytics.llm_events_daily
  ADD COLUMN IF NOT EXISTS total_tokens      INT     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd FLOAT  DEFAULT 0.0;
```

> 기존 rows는 DEFAULT 0으로 채워지므로 하위 호환 유지.

---

### Step 8 — 테스트

**pytest (`engine/tests/`)**

`engine/tests/unit/services/test_llm_client.py` — **기존 mock 전수 수정 필요:**

현재 mock이 `response.usage` 없음 → `LLMResult` 반환 후 `.content` 접근 테스트 깨짐.
모든 `make_mock_llm()` / `mock_llm()` 헬퍼에 usage mock 추가:
```python
fake.chat.completions.create.return_value.usage = MagicMock(
    prompt_tokens=10, completion_tokens=5, total_tokens=15
)
```

`engine/tests/integration/test_interview_router.py` 등 통합 테스트 — **mock 헬퍼 전수 수정:**
- `mock_llm()`, `mock_llm_side_effect()` 헬퍼에 동일하게 `.usage` 추가
- 응답 JSON에 `"usage"` 필드 존재 검증 assertion 추가

신규 테스트 항목:
- `LLMResult.usage` 값 정확성 검증 (prompt_tokens, completion_tokens, total_tokens)
- 각 router 응답에 `usage` 필드 존재·값 검증
- `usage=None` 케이스: API 오류 시 `response.usage=None` → 응답에 `"usage": null` 포함되고 기능 흐름 정상 유지
- `LLMError` 발생 시에도 기존 500 응답 유지 (regression)

**vitest (`services/siw/tests/`)**

`services/siw/tests/unit/event-logger.test.ts` — **`withEventLogging` 시그니처 변경으로 기존 테스트 깨짐:**
- `fn` 콜백 반환 타입이 `T` → `{ data: T; usage?: EngineUsage }` 로 변경되므로 기존 테스트 콜백 전수 수정

신규 테스트 항목:
- `estimateCostUsd()` 정상 케이스 (알려진 모델명)
- `estimateCostUsd()` unknown model fallback — `0.0` 반환 또는 명시적 처리 검증
- `withEventLogging` 에서 usage 필드(`prompt_tokens`, `completion_tokens`, `model`)가 이벤트에 포함되는지 검증
- usage 없는 경우(`usage=undefined`) 이벤트 로그에 해당 필드 누락되고 기능 흐름 유지 검증

---

## 작업 순서 (의존성)

```
Step 1 (llm_client) → Step 3 (service) → Step 4 (router)
Step 2 (schemas)    ↗
Step 5, 6, 7 는 독립적으로 병렬 진행 가능
Step 8 (테스트) 는 마지막
```

---

## 주의사항

- `call_llm()` 반환 타입 변경이 파급 범위 가장 큼 — `parse_object(result.content)` 로 호출부 전수 수정 필요
- `interview_service.py`는 `call_llm as _call_llm` **aliased import** 사용 — `call_llm` grep 시 누락됨, `_call_llm`로도 검색 필요
- `llm_service.py`는 `parse_llm_response(raw)` 패턴 — `parse_object`와 별도 처리 (패턴 B)
- 모든 router가 service 결과를 직접 return 하는 구조 — service 튜플 전환 시 router 전수 동시 수정 필수
- `withEventLogging` 시그니처 변경 시 기존 API route 호출부 전수 수정 필요
- usage `None` 케이스 항상 optional 처리 — engine 응답에 usage 없어도 기능 흐름 중단 금지
- `response.usage`는 API 오류·timeout 시 `None`일 수 있음 — `if usage:` 가드 필수
