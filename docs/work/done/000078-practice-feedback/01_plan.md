# [#78] feat: [Phase 3][Engine] 기능 05 — 연습 모드 즉각 피드백 엔진 구현 (POST /api/practice/feedback) — 구현 계획

> 작성: 2026-03-12
> 검토: 아키텍쳐 전문가 + TDD 전문가 + 서버 전문가 협업

---

## 완료 기준 (AC)

- [x] `POST /api/practice/feedback` 엔드포인트가 존재하고 동작한다
- [x] `previousAnswer` 없이 호출 → `200` + `{ score, feedback, keywords, improvedAnswerGuide, comparisonDelta: null }` 반환
- [x] `previousAnswer` 포함 호출 → `200` + 위 필드 + `comparisonDelta: { scoreDelta, improvements }` 반환
- [x] `score`는 0–100 정수, `_clamp()` 보정 후 모델 생성
- [x] `feedback.good/improve` 각 1–3개 — LLM 초과 반환 시 `[:3]` 슬라이싱, 빈 배열 시 fallback
- [x] `keywords` 1–5개 — LLM 초과 반환 시 `[:5]` 슬라이싱
- [x] `improvedAnswerGuide` 비어있지 않아야 한다 (빈 문자열 시 fallback)
- [x] `comparisonDelta`는 `previousAnswer` 없으면 `null`, 있으면 `{ scoreDelta: int, improvements: list[str] }` 반환
- [x] 필수 필드 누락 → `400` 반환
- [x] LLM 호출 실패 → `500` 반환
- [x] `engine/app/prompts/practice_feedback_v1.md` 버전 관리
- [x] pytest TDD (단위 13개 + 통합 5개) 전체 통과 및 기존 회귀 없음

---

## 아키텍쳐 개요

### 신규 생성 파일 (4개)

| 파일 | 목적 |
|------|------|
| `engine/app/services/practice_service.py` | 연습 피드백 비즈니스 로직 (`report_service.py` 패턴 동일) |
| `engine/app/routers/practice.py` | `POST /api/practice/feedback` 엔드포인트 |
| `engine/app/prompts/practice_feedback_v1.md` | 단일 답변 피드백 프롬프트 |
| `engine/app/prompts/practice_feedback_retry_v1.md` | 재답변 비교 피드백 프롬프트 |

### 수정 파일 (3개)

| 파일 | 변경 내용 |
|------|-----------|
| `engine/app/schemas.py` | `FeedbackDetail`, `ComparisonDelta`, `PracticeFeedbackRequest`, `PracticeFeedbackResponse` 4개 모델 추가 |
| `engine/app/parsers/exceptions.py` | `PracticeParseError(LLMError)` 추가 |
| `engine/app/main.py` | practice router import + `include_router` 2줄 추가 |

### 예외 계층

```
LLMError (독립)               → HTTP 500
├── ReportParseError          → HTTP 500
└── PracticeParseError  ← NEW → HTTP 500 (기존 handle_500 핸들러 자동 포착)
```

**중요:** `PracticeParseError`는 `LLMError` 하위 클래스이므로 `main.py`에 별도 exception handler 추가 불필요.

---

## 스키마 설계 (`schemas.py` 추가 코드)

```python
# --- 연습 모드 피드백 ---

class FeedbackDetail(BaseModel):
    good:    list[str] = Field(..., min_length=1, max_length=3, description="잘한 점 1-3개")
    improve: list[str] = Field(..., min_length=1, max_length=3, description="개선할 점 1-3개")


class ComparisonDelta(BaseModel):
    scoreDelta:   int       = Field(..., ge=-100, le=100, description="이전 대비 점수 변화")
    improvements: list[str] = Field(default_factory=list, description="구체적 개선 사항 (0개 이상)")


class PracticeFeedbackRequest(BaseModel):
    question:       str          = Field(..., min_length=1, description="면접 질문")
    answer:         str          = Field(..., min_length=1, max_length=5000, description="사용자 답변")
    previousAnswer: str | None   = Field(None, min_length=1, max_length=5000, description="이전 답변 (비교용, 선택)")


class PracticeFeedbackResponse(BaseModel):
    score:               int                     = Field(..., ge=0, le=100)
    feedback:            FeedbackDetail
    keywords:            list[str]               = Field(..., min_length=1, max_length=5)
    improvedAnswerGuide: str                     = Field(..., min_length=1)
    comparisonDelta:     ComparisonDelta | None  = None
```

---

## 구현 계획 (6단계)

### 1단계 — 스키마 + 예외 정의 (Red 진입)

**수정 파일:** `engine/app/schemas.py`, `engine/app/parsers/exceptions.py`

1. `schemas.py` 맨 아래에 위의 4개 모델 추가
2. `exceptions.py` 마지막 줄에 추가:
   ```python
   class PracticeParseError(LLMError): pass
   ```

**완료 기준:** `from app.schemas import PracticeFeedbackRequest, PracticeFeedbackResponse` import 성공

---

### 2단계 — 프롬프트 파일 작성

**신규 파일:** `engine/app/prompts/practice_feedback_v1.md`

```markdown
당신은 취업 면접 코치입니다.
아래 면접 질문과 지원자의 답변을 분석하여 즉각적인 피드백을 제공하세요.

## 면접 질문
{question}

## 지원자 답변
{answer}

## 지시사항
- 답변의 강점과 개선점을 구체적으로 파악하세요
- STAR 구조(상황·과제·행동·결과) 관점에서 평가하세요
- 개선된 답변을 위한 실용적인 가이드를 제공하세요

## 출력 형식 (JSON만 출력, 다른 텍스트 없이)

```json
{
  "score": 75,
  "feedback": {
    "good": ["STAR 구조를 명확히 사용했습니다", "구체적인 수치를 제시했습니다"],
    "improve": ["본인의 역할을 더 구체적으로 설명하세요"]
  },
  "keywords": ["STAR 구조", "수치 근거", "주도적 역할"],
  "improvedAnswerGuide": "답변 서두에 상황(S)을 1~2문장으로 요약하고, 본인이 맡은 과제(T)와 행동(A)을 명확히 구분하세요."
}
```

규칙:
- score: 0~100 정수 (50=보통, 75=양호, 90+=우수)
- feedback.good: 1~3개
- feedback.improve: 1~3개
- keywords: 1~5개
- improvedAnswerGuide: 200자 이내
```

**신규 파일:** `engine/app/prompts/practice_feedback_retry_v1.md`

```markdown
당신은 취업 면접 코치입니다.
지원자가 피드백을 받은 후 동일 질문에 재답변했습니다.
이전 답변과 새 답변을 비교 분석하여 개선도를 평가하세요.

## 면접 질문
{question}

## 이전 답변 (1차)
{previous_answer}

## 새 답변 (2차, 피드백 반영 후)
{answer}

## 지시사항
- 새 답변 자체의 품질을 0~100으로 평가하세요 (절대 점수)
- 이전 답변 대비 개선된 점과 아직 부족한 점을 분석하세요
- scoreDelta는 (새 점수 - 이전 점수)의 추정값입니다

## 출력 형식 (JSON만 출력, 다른 텍스트 없이)

```json
{
  "score": 82,
  "feedback": {
    "good": ["1차 피드백에서 지적된 수치 근거를 추가했습니다"],
    "improve": ["리더십 역할이 여전히 모호합니다"]
  },
  "keywords": ["STAR 구조", "수치 근거"],
  "improvedAnswerGuide": "이번 답변은 전반적으로 향상됐습니다. 다음엔 본인 기여도 대비 팀 기여도를 명시하면 더욱 설득력이 높아집니다.",
  "comparisonDelta": {
    "scoreDelta": 7,
    "improvements": ["구체적인 수치를 추가해 신뢰도 향상", "과제(T)와 행동(A) 구분이 명확해짐"]
  }
}
```

규칙:
- score: 0~100 절대 점수
- feedback.good/improve: 각 1~3개
- keywords: 1~5개
- improvedAnswerGuide: 200자 이내
- comparisonDelta.scoreDelta: 양수=향상, 음수=하락
- comparisonDelta.improvements: 실제 개선된 점 0~3개
```

---

### 3단계 — `practice_service.py` 구현

**신규 파일:** `engine/app/services/practice_service.py`

`report_service.py` 패턴 완전 동일 적용:

```python
import json
from pathlib import Path
from app.parsers.exceptions import LLMError, PracticeParseError
from app.schemas import PracticeFeedbackResponse, FeedbackDetail, ComparisonDelta
from app.services.llm_client import call_llm, strip_code_block

PROMPT_DIR = Path(__file__).parent.parent / "prompts"


def _clamp(val) -> int:
    try:
        return max(0, min(100, int(val)))
    except (TypeError, ValueError):
        return 50


def _build_prompt(question: str, answer: str) -> str:
    template = (PROMPT_DIR / "practice_feedback_v1.md").read_text(encoding="utf-8")
    return template.replace("{question}", question).replace("{answer}", answer[:5000])


def _build_retry_prompt(question: str, previous_answer: str, answer: str) -> str:
    template = (PROMPT_DIR / "practice_feedback_retry_v1.md").read_text(encoding="utf-8")
    return (
        template
        .replace("{question}", question)
        .replace("{previous_answer}", previous_answer[:5000])
        .replace("{answer}", answer[:5000])
    )


def _parse_delta(data: dict) -> ComparisonDelta | None:
    raw = data.get("comparisonDelta")
    if not isinstance(raw, dict):
        return None
    try:
        score_delta = int(raw.get("scoreDelta", 0))
    except (TypeError, ValueError):
        score_delta = 0
    raw_imp = raw.get("improvements", [])
    improvements = [str(x) for x in raw_imp] if isinstance(raw_imp, list) else []
    return ComparisonDelta(scoreDelta=score_delta, improvements=improvements)


def _parse_feedback(raw: str, *, is_retry: bool = False) -> PracticeFeedbackResponse:
    try:
        s = strip_code_block(raw)
        data = json.loads(s)
    except json.JSONDecodeError as e:
        raise PracticeParseError(f"연습 피드백 JSON 파싱 실패: {e}") from e

    if not isinstance(data, dict):
        raise PracticeParseError("연습 피드백 응답이 객체가 아닙니다")

    score = _clamp(data.get("score", 50))

    raw_fb = data.get("feedback", {})
    if not isinstance(raw_fb, dict):
        raw_fb = {}
    raw_good    = raw_fb.get("good", [])
    raw_improve = raw_fb.get("improve", [])
    good    = [str(x) for x in raw_good    if str(x).strip()][:3] or ["강점을 확인하지 못했습니다"]
    improve = [str(x) for x in raw_improve if str(x).strip()][:3] or ["개선 포인트를 찾지 못했습니다"]

    raw_kw   = data.get("keywords", [])
    keywords = [str(x) for x in raw_kw if str(x).strip()][:5] or ["STAR 구조"]

    guide = str(data.get("improvedAnswerGuide", "")).strip() or "가이드를 생성하지 못했습니다."

    delta = _parse_delta(data) if is_retry else None

    return PracticeFeedbackResponse(
        score=score,
        feedback=FeedbackDetail(good=good, improve=improve),
        keywords=keywords,
        improvedAnswerGuide=guide,
        comparisonDelta=delta,
    )


def generate_practice_feedback(
    question: str,
    answer: str,
    previous_answer: str | None = None,
    *,
    model: str | None = None,
) -> PracticeFeedbackResponse:
    is_retry = previous_answer is not None
    prompt = _build_retry_prompt(question, previous_answer, answer) if is_retry \
             else _build_prompt(question, answer)
    raw = call_llm(
        prompt,
        model=model,
        timeout=30.0,
        max_tokens=2048,
        error_message="연습 피드백 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    )
    return _parse_feedback(raw, is_retry=is_retry)
```

**`report_service.py`와의 패턴 비교:**

| 항목 | report_service.py | practice_service.py |
|------|------------------|---------------------|
| `_clamp()` | 동일 | 동일 |
| `_build_prompt()` | resume + history | question + answer |
| `_parse_*()` | `_parse_report()` | `_parse_feedback()` |
| 예외 | `ReportParseError` | `PracticeParseError` |
| LLM timeout | 60s | 30s |
| max_tokens | 2048 | 2048 |

---

### 4단계 — 라우터 + `main.py` 등록

**신규 파일:** `engine/app/routers/practice.py`

```python
from fastapi import APIRouter
from app.schemas import PracticeFeedbackRequest, PracticeFeedbackResponse
from app.services.practice_service import generate_practice_feedback

router = APIRouter()


@router.post("/practice/feedback", response_model=PracticeFeedbackResponse)
async def practice_feedback_endpoint(body: PracticeFeedbackRequest):
    return generate_practice_feedback(
        body.question,
        body.answer,
        body.previousAnswer,
    )
```

**`engine/app/main.py` 수정 diff:**

```diff
 from app.routers.report import router as report_router
+from app.routers.practice import router as practice_router

 app.include_router(report_router, prefix="/api")
+app.include_router(practice_router, prefix="/api")
```

---

### 5단계 — TDD 테스트 작성 및 통과 확인

#### 단위 테스트 (`engine/tests/unit/services/test_practice_service.py`) — 11개

| # | 함수명 | 목적 |
|---|--------|------|
| 1 | `test_generate_practice_feedback_returns_valid_response` | 단일 답변 정상 응답 구조 |
| 2 | `test_generate_practice_feedback_score_within_range` | score 0–100 범위 검증 |
| 3 | `test_generate_practice_feedback_comparison_delta_none_without_previous` | previousAnswer=None → comparisonDelta=None |
| 4 | `test_generate_practice_feedback_comparison_delta_exists_with_previous` | previousAnswer 포함 → comparisonDelta 존재 |
| 5 | `test_generate_practice_feedback_score_clamped_over_100` | score=105 → 100 |
| 6 | `test_generate_practice_feedback_score_clamped_negative` | score=-5 → 0 |
| 7 | `test_generate_practice_feedback_good_truncated_to_3` | good 4개 → 3개 슬라이싱 |
| 8 | `test_generate_practice_feedback_empty_good_uses_fallback` | good=[] → fallback 문자열 |
| 9 | `test_generate_practice_feedback_empty_guide_uses_fallback` | guide="" → fallback 문자열 |
| 10 | `test_generate_practice_feedback_llm_error_raises_llm_error` | LLM API 오류 → `LLMError` |
| 11 | `test_generate_practice_feedback_invalid_json_raises_parse_error` | 잘못된 JSON → `PracticeParseError` |
| 12 | `test_generate_practice_feedback_improve_truncated_to_3` | improve 4개 → 3개 슬라이싱 (AC #5) |
| 13 | `test_generate_practice_feedback_keywords_truncated_to_5` | keywords 6개 → 5개 슬라이싱 (AC #6) |

**공통 mock 패턴:**
```python
def make_mock_llm(content: str):
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=content))
    ]
    return fake

# 사용:
with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(JSON_STR)):
    from app.services.practice_service import generate_practice_feedback
    result = generate_practice_feedback("질문", "답변")
```

**테스트 #12 — improve 슬라이싱 (AC #5):**
```python
def test_generate_practice_feedback_improve_truncated_to_3():
    json_str = json.dumps({
        "score": 70,
        "feedback": {"good": ["좋아요"], "improve": ["A", "B", "C", "D"]},
        "keywords": ["k"],
        "improvedAnswerGuide": "guide"
    })
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result = generate_practice_feedback("질문", "답변")
    assert len(result.feedback.improve) == 3
```

**테스트 #13 — keywords 슬라이싱 (AC #6):**
```python
def test_generate_practice_feedback_keywords_truncated_to_5():
    json_str = json.dumps({
        "score": 70,
        "feedback": {"good": ["좋아요"], "improve": ["개선"]},
        "keywords": ["A", "B", "C", "D", "E", "F"],
        "improvedAnswerGuide": "guide"
    })
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result = generate_practice_feedback("질문", "답변")
    assert len(result.keywords) == 5
```

#### 통합 테스트 (`engine/tests/integration/test_practice_router.py`) — 5개

| # | 함수명 | status | 핵심 검증 |
|---|--------|--------|-----------|
| 1 | `test_practice_feedback_200_single` | 200 | comparisonDelta is None |
| 2 | `test_practice_feedback_200_with_previous_answer` | 200 | comparisonDelta 존재, scoreDelta int |
| 3 | `test_practice_feedback_400_missing_question` | 400 | question 누락 |
| 4 | `test_practice_feedback_400_missing_answer` | 400 | answer 누락 |
| 5 | `test_practice_feedback_500_llm_error` | 500 | LLM mock side_effect |

#### Fixture 파일 (`engine/tests/fixtures/output/`)

| 파일 | 용도 |
|------|------|
| `mock_practice_feedback_single.json` | 단일 답변 피드백 (comparisonDelta 없음) |
| `mock_practice_feedback_retry.json` | 재답변 피드백 (comparisonDelta 포함, scoreDelta=13) |
| `mock_practice_feedback_overlong.json` | 슬라이싱 테스트용 (good 4개, keywords 6개) |

---

### 6단계 — `.ai.md` 최신화

| 파일 | 업데이트 섹션 | 내용 |
|------|-------------|------|
| `engine/.ai.md` | API 계약 + 예외 계층 | `POST /api/practice/feedback` 추가; 예외 트리에 `PracticeParseError(LLMError)` 추가 |
| `engine/app/routers/.ai.md` | 라우터 목록 | `practice.py` 추가 |
| `engine/app/services/.ai.md` | 서비스 목록 | `practice_service.py` 추가 |
| `engine/app/prompts/.ai.md` | 프롬프트 목록 | 2종 프롬프트 파일 추가 |
| `engine/app/parsers/.ai.md` | 예외 목록 | `PracticeParseError` 추가 |
| `engine/tests/.ai.md` | 테스트 파일 구조 | 단위 1종 + 통합 1종 + fixture 3종 추가 |

`engine/.ai.md` 추가 내용:
```
POST /api/practice/feedback
  Request:  { question: str, answer: str, previousAnswer?: str }
  Response: { score: int(0-100), feedback: {good: str[], improve: str[]},
              keywords: str[], improvedAnswerGuide: str,
              comparisonDelta?: { scoreDelta: int, improvements: str[] } }
  Error:    400 (필드 누락/빈 문자열), 500 (LLM 오류/JSON 파싱 실패)
  Timeout:  30s, max_tokens: 2048
```

---

## 에러 처리 매트릭스

| 상황 | 예외 | HTTP | 처리 위치 |
|------|------|------|-----------|
| question/answer 누락·빈 문자열 | `RequestValidationError` | 400 | `main.py handle_validation_error` |
| LLM API 호출 실패 | `LLMError` | 500 | `main.py handle_500` |
| LLM 응답 JSON 파싱 실패 | `PracticeParseError(LLMError)` | 500 | `main.py handle_500` (상속 자동 포착) |
| LLM 응답 초과·빈 값 | — | 200 | `_parse_feedback` 내부 fallback |
| comparisonDelta 형식 오류 | — | 200 | `_parse_delta` None fallback |

---

## 불변식 검증

- [x] **LLM API 호출은 engine/services/ 에서만** — `practice_service.py`는 `llm_client.call_llm` 사용
- [x] **인증 로직 없음** — `PracticeFeedbackRequest`에 user/auth 필드 없음
- [x] **stateless** — 전역 가변 상태 없음, DB 접근 없음
- [x] **서비스 간 직접 통신 금지** — 엔진은 독립 API 제공만
- [x] **테스트 없는 PR 머지 금지** — 단위 13개 + 통합 5개 필수

---

## 구현 의존성 그래프

```
1단계 (스키마+예외)
    ↓
2단계 (프롬프트)  ←→  3단계 (service) — 병렬 작업 가능
                              ↓
                       4단계 (router + main.py)
                              ↓
                       5단계 (테스트 전체 통과)
                              ↓
                       6단계 (.ai.md 최신화)
```

> 2단계와 3단계는 병렬 작업 가능 (service 구현 시 프롬프트 파일은 mock으로 대체 가능)

---

## Red → Green → Refactor 순서

### Phase 1 — Red (테스트 먼저 작성)
1. `exceptions.py`에 `PracticeParseError` 추가
2. `schemas.py`에 4개 모델 추가
3. 단위 테스트 13개 작성 → `import` 실패 / service 없음 = **Red**
4. 통합 테스트 5개 작성 → 404 = **Red**

### Phase 2 — Green (최소 구현)
5. 프롬프트 파일 2종 작성
6. `practice_service.py` 구현
7. `routers/practice.py` 작성
8. `main.py` 2줄 추가
9. `pytest engine/tests/ -x` → **Green**

### Phase 3 — Refactor
10. `_parse_feedback` 내부 슬라이싱 로직 정리 (필요 시)
11. `.ai.md` 최신화
12. `pytest engine/tests/ -v` → 기존 회귀 없이 전체 통과 확인
