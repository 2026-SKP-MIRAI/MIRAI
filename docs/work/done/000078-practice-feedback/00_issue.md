# feat: [Phase 3][Engine] 기능 05 — 연습 모드 즉각 피드백 엔진 구현 (POST /api/practice/feedback)

## 사용자 관점 목표
"질문 → 답변 → 즉각 피드백 → 재답변 → 피드백 → 다음 질문"의 순환 구조로, 매 질문마다 한 번의 재도전 기회를 주어 반복 연습 효과를 극대화한다.

## 배경
`docs/specs/mirai/dev_spec.md` §4 기능 05 — 연습 모드 및 즉각 피드백 시스템 (Phase 3).  
Phase 1(패널 면접·꼬리질문)·Phase 2(8축 리포트) 완료 후 진행한다.

## 연습 모드 정확한 플로우

```
MirAI  : 질문 1
사용자 : 답변 1
         → POST /api/practice/feedback { question, answer: "답변1" }
MirAI  : 답변1 피드백 (score, good/improve, keywords, guide) + "다시 답변해보세요"
사용자 : 피드백 반영한 답변 2
         → POST /api/practice/feedback { question, answer: "답변2", previousAnswer: "답변1" }
MirAI  : 답변2 피드백 + 이전 답변 대비 개선 비교(comparisonDelta)
         → 다음 질문 2로 이동

MirAI  : 질문 2
         (동일 사이클 반복)
```

**동일 엔드포인트를 질문당 2번 호출**한다.  
- 1번째 호출: `previousAnswer` 없음 → 단일 피드백 + 개선 가이드  
- 2번째 호출: `previousAnswer` 포함 → 개선 비교 피드백 + `comparisonDelta`

## 완료 기준
- [x] `POST /api/practice/feedback` 엔드포인트가 존재하고 동작한다
- [x] `previousAnswer` 없이 호출 → `200` + `{ score, feedback, keywords, improvedAnswerGuide }` 반환
- [x] `previousAnswer` 포함 호출 → `200` + 위 필드 + `comparisonDelta` 반환
- [x] `score`는 0–100 정수, `_clamp()` 보정 후 모델 생성 (Pydantic 검증에만 의존하지 않음)
- [x] `feedback.good/improve` 각 1–3개 — LLM 초과 반환 시 `[:3]` 슬라이싱, 빈 배열 시 fallback
- [x] `keywords` 1–5개 — LLM 초과 반환 시 `[:5]` 슬라이싱
- [x] `improvedAnswerGuide` 비어있지 않아야 한다 (`min_length=1`)
- [x] `comparisonDelta`는 `previousAnswer` 없으면 `null`, 있으면 `{ scoreDelta: int, improvements: list[str] }` 반환
- [x] 필수 필드 누락 → `400` 반환
- [x] LLM 호출 실패 → `500` 반환
- [x] `engine/app/prompts/practice_feedback_v1.md` 버전 관리
- [x] pytest TDD (단위 + 통합) 전체 통과 및 기존 회귀 없음

## 구현 플랜

### 1단계 — 스키마 + 예외 (Red → Green)

```python
# schemas.py 추가
class FeedbackDetail(BaseModel):
    good:    list[str] = Field(..., min_length=1, max_length=3)
    improve: list[str] = Field(..., min_length=1, max_length=3)

class ComparisonDelta(BaseModel):
    scoreDelta:   int           # 양수 = 향상, 음수 = 하락
    improvements: list[str]    # "이번 답변에서 개선된 점" 목록

class PracticeFeedbackRequest(BaseModel):
    question:      str          = Field(..., min_length=1)
    answer:        str          = Field(..., min_length=1)
    previousAnswer: str | None  = None   # 2번째 호출(재답변) 시 포함

class PracticeFeedbackResponse(BaseModel):
    score:               int               = Field(..., ge=0, le=100)
    feedback:            FeedbackDetail
    keywords:            list[str]         = Field(..., min_length=1, max_length=5)
    improvedAnswerGuide: str               = Field(..., min_length=1)
    comparisonDelta:     ComparisonDelta | None = None  # previousAnswer 없으면 null

# exceptions.py 추가
class PracticeParseError(LLMError): pass
```

### 2단계 — 프롬프트 2종 작성

**`practice_feedback_v1.md`** (단일 답변 피드백 — 1번째 호출)
- 입력: 질문 + 답변
- 출력: `{ score, feedback, keywords, improvedAnswerGuide }`

**`practice_feedback_retry_v1.md`** (재답변 비교 피드백 — 2번째 호출)
- 입력: 질문 + 이전 답변 + 새 답변
- 출력: `{ score, feedback, keywords, improvedAnswerGuide, comparisonDelta: { scoreDelta, improvements } }`

### 3단계 — `practice_service.py` 구현

`report_service._parse_report` 패턴 동일 적용 (수동 파싱 + fallback):

```python
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
    raw = call_llm(prompt, timeout=30.0, max_tokens=1024, ...)
    return _parse_feedback(raw, is_retry=is_retry)

def _parse_feedback(raw: str, *, is_retry: bool = False) -> PracticeFeedbackResponse:
    # 수동 JSON 파싱 + _clamp + 슬라이싱 + fallback
    score    = _clamp(data.get("score", 50))
    good     = [str(x) for x in raw_good][:3]    or ["강점을 확인하지 못했습니다"]
    improve  = [str(x) for x in raw_improve][:3] or ["개선 포인트를 찾지 못했습니다"]
    keywords = [str(x) for x in raw_kw][:5]      or ["STAR 구조"]
    guide    = str(data.get("improvedAnswerGuide", "")).strip() or "가이드를 생성하지 못했습니다."
    delta    = _parse_delta(data) if is_retry else None
    ...
```

### 4단계 — 라우터 + main.py 등록

```python
# engine/app/routers/practice.py
@router.post("/practice/feedback", response_model=PracticeFeedbackResponse)
async def practice_feedback_endpoint(body: PracticeFeedbackRequest):
    return generate_practice_feedback(
        body.question, body.answer, body.previousAnswer
    )
```

### 5단계 — TDD 테스트

**단위 테스트** (`tests/unit/services/test_practice_service.py`)
- 단일 답변 호출 → comparisonDelta=None
- 재답변 호출(`previousAnswer` 있음) → comparisonDelta 존재
- score 클램핑 (105 → 100, -5 → 0)
- good 4개 반환 → 3개로 슬라이싱
- 빈 배열 반환 → fallback 동작
- 빈 guide → fallback 동작
- JSON 파싱 실패 → PracticeParseError
- LLM 오류 → LLMError

**통합 테스트** (`tests/integration/test_practice_router.py`)
- 200 단일 답변 (comparisonDelta=null)
- 200 재답변 (previousAnswer 포함, comparisonDelta 존재)
- 400 question 누락
- 400 answer 누락
- 500 LLM 오류

### 6단계 — `.ai.md` 최신화
`engine/.ai.md` API 계약에 `POST /api/practice/feedback` 추가.
`engine/app/routers/.ai.md`, `engine/app/services/.ai.md`, `engine/app/prompts/.ai.md` 업데이트.

## 에러 처리 전략

| 상황 | 예외 | HTTP |
|------|------|------|
| 필수 필드 누락 | Pydantic `ValidationError` | 400 |
| LLM API 오류 | `LLMError` | 500 |
| JSON 파싱 실패 | `PracticeParseError(LLMError)` | 500 |
| LLM 응답 초과·빈 값 | — | 200 (fallback 자동 처리) |

## 개발 체크리스트
- [ ] 테스트 코드 포함 (단위 + 통합, TDD Red→Green→Refactor)
- [ ] 해당 디렉토리 `.ai.md` 최신화 (`engine/.ai.md` API 계약 포함)
- [ ] 불변식 위반 없음 (LLM 호출 `engine/services/`에서만, stateless)
- [ ] 기존 pytest 전체 회귀 없음

---

## 작업 내역

### 신규 생성 파일

- **`engine/app/services/practice_service.py`**: 연습 피드백 핵심 비즈니스 로직. `report_service.py` 패턴을 그대로 적용해 `_clamp()`, `_build_prompt()`, `_build_retry_prompt()`, `_parse_feedback()`, `_parse_delta()` 함수로 구성. `previousAnswer` 유무에 따라 프롬프트를 분기하고, LLM 응답을 방어적으로 파싱(슬라이싱/fallback). `max_tokens=2048` (한국어 토큰 효율 고려해 1024 → 2048 상향).
- **`engine/app/routers/practice.py`**: `POST /api/practice/feedback` 엔드포인트. Pydantic 스키마가 입력 검증을 담당하므로 라우터는 서비스 호출과 반환만 수행.
- **`engine/app/prompts/practice_feedback_v1.md`**: 단일 답변 피드백 프롬프트. STAR 구조 기준 평가 + Few-shot JSON 예시로 출력 형식 고정.
- **`engine/app/prompts/practice_feedback_retry_v1.md`**: 재답변 비교 피드백 프롬프트. 이전/새 답변 비교 + `comparisonDelta` 출력 포함.
- **`engine/tests/unit/services/test_practice_service.py`**: 단위 테스트 13개. LLM mock으로 서비스 로직 검증 (clamp, 슬라이싱, fallback, 예외 발생 등).
- **`engine/tests/integration/test_practice_router.py`**: 통합 테스트 5개. 실제 FastAPI 앱 대상 HTTP 요청/응답 전체 흐름 검증 (200/400/500).
- **`engine/tests/fixtures/output/mock_practice_feedback_single.json`**: 단일 피드백 LLM 응답 fixture.
- **`engine/tests/fixtures/output/mock_practice_feedback_retry.json`**: 재답변 피드백 LLM 응답 fixture.
- **`engine/tests/fixtures/output/mock_practice_feedback_overlong.json`**: 슬라이싱 테스트용 fixture (good 4개, keywords 6개).

### 수정 파일

- **`engine/app/schemas.py`**: `FeedbackDetail`, `ComparisonDelta`, `PracticeFeedbackRequest`, `PracticeFeedbackResponse` 4개 Pydantic 모델 추가. `ComparisonDelta.improvements`는 `Field(default_factory=list)` — `min_length=1` 제거로 빈 배열 허용.
- **`engine/app/parsers/exceptions.py`**: `PracticeParseError(LLMError)` 추가. `main.py`의 기존 `handle_500` 핸들러가 상속으로 자동 포착.
- **`engine/app/main.py`**: `practice_router` import + `include_router` 2줄 추가.
- **`.ai.md` 6개**: `engine/.ai.md`, `routers/.ai.md`, `services/.ai.md`, `prompts/.ai.md`, `parsers/.ai.md`, `tests/.ai.md` 최신화.

### 기술적 결정 사항

- `max_tokens` 1024 → 2048 상향: 한국어는 영어 대비 토큰 소모가 많아 응답 잘림 위험 방지
- `ComparisonDelta.improvements` fallback: `min_length=1` 제거 — `_parse_delta`가 `improvements=[]` 반환 시 Pydantic ValidationError 방지
- 최종 pytest: 107/107 PASS (신규 18개 + 기존 89개)

