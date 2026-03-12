# feat: [Phase 2][Engine] 기능07 — 8축 역량 평가 및 실행형 리포트 엔진 구현

## 사용자 관점 목표

면접 세션 종료 후 8개 역량 축에 걸친 정량적 점수와, 강점은 칭찬·약점은 바로 실천할 수 있는 실행형 피드백을 받아 **명확한 성장 기준점**을 확보한다.

## 배경

dev_spec Phase 2 = 기능07 「8축 역량 평가 및 실행형 리포트」.
Phase 1(패널 면접 + 꼬리질문)이 완료된 상태로, 이제 세션 전체를 평가하는 리포트 엔진을 추가한다.

- **8개 역량 축:** 의사소통 / 문제해결 / 논리적 사고 / 직무 전문성 / 조직 적합성 / 리더십 / 창의성 / 성실성
- **진입 조건:** 답변 5개 이상 후 세션 종료 시 리포트 생성. 미만 시 422 에러 반환
- **growthCurve:** Phase 3 DB 도입 전까지 `null` 반환 (타입 고정)

## 아키텍처 결정 (3인 설계 합의)

| 결정 | 선택 | 이유 |
|------|------|------|
| 엔진 요청 body | `resumeText + history` 전달 | 엔진 stateless 불변식 준수 — sessionId 단독 불가 |
| LLM 호출 방식 | **단일 1회 호출** | 비용 ~7.5배 차이, 축간 일관성. 하단 "LLM 호출 전략 비교" 참조 |
| `_call_llm` 공통화 | `services/llm_client.py`로 추출 | interview_service · report_service 중복 제거 |
| 최소 답변 검증 | Pydantic(min_length) + 서비스 로직 2단 | 방어적 설계 |
| 축 피드백 구조 | **8축 전체 + 점수 기반 톤 분기** | 강점 칭찬 + 약점 실행형 피드백, 빠짐없이 전달 |

## LLM 호출 전략 비교

> FastAPI는 async를 지원하므로 `AsyncOpenAI` + `asyncio.gather`로 8축 병렬 호출이 기술적으로 가능하다.
> 단일 호출을 선택한 이유는 아래 비교 기준에 따른 결정이며, **추후 평가 정밀도가 부족하다고 판단되면 `report_service.py` 내부만 교체하여 병렬로 전환 가능** (라우터/스키마 변경 불필요).

### 토큰 · 비용 비교 (세션 5개 Q&A 기준)

| | 단일 호출 | 비동기 병렬 (8축 + 종합) |
|--|----------|--------------------------|
| 호출 횟수 | 1 | 8 + 1 = **9** |
| 입력 토큰 | ~4,000 × 1 = **4,000** | ~4,000 × 9 = **36,000** |
| 출력 토큰 | ~800 | ~100×8 + ~600 = **1,400** |
| **총 토큰** | **~4,800** | **~37,400** |
| **비용 배율** | **1x** | **~7.5x** |

> Gemini 2.5 Flash 기준: 단일 ~$0.0005 / 리포트, 병렬 ~$0.0038 / 리포트 (월 1,000건: $0.5 vs $3.8)

### 지연시간(Latency) 비교

```
단일 호출:
  [──────────── 출력 800토큰 순차 생성 ────────────]  ~12–18s

비동기 병렬:
  [─ 축1(100tok) ─]
  [─ 축2(100tok) ─]  <- 8개 동시 실행 ~3–5s
  ...
  [─ 축8(100tok) ─]
                    [── 종합 합산 호출(600tok) ──]  ~5–8s
  총 ~8–13s
```

| | 단일 호출 | 비동기 병렬 |
|--|----------|-----------|
| 예상 응답시간 | 12–18s | **8–13s** (약 4–6s 빠름) |
| 축간 일관성 | ✅ 전체 맥락 동시 평가 | 각 축 독립 평가, 합산 시 불균형 가능 |
| 오류 격리 | 전체 실패 | ✅ 특정 축만 재시도 가능 |
| 구현 복잡도 | ✅ 단순 | 축별 프롬프트 8개 + 합산 로직 필요 |

병렬 전환 시 교체할 코드 (라우터/스키마 변경 없음):

```python
async def generate_report(resumeText: str, history: list[HistoryItem]) -> ReportResponse:
    client = AsyncOpenAI(...)
    tasks = [_evaluate_axis(client, key, history_text) for key in AXIS_KEYS]
    axis_results = await asyncio.gather(*tasks)
    summary = await _generate_summary(client, axis_results, history_text)
    return _build_response(axis_results, summary)
```

## 완료 기준

- [x] `POST /api/report/generate` 엔드포인트가 존재하고 동작한다
- [x] `history` 5개 이상 → `200` + `{ scores(8축), totalScore, summary, axisFeedbacks(8개) }` 반환
- [x] `history` 5개 미만 → `422` + 한국어 안내 메시지 반환
- [x] LLM 호출 실패 → `500` 반환
- [x] 필수 필드 누락 → `400` 반환
- [x] `AxisScores` 각 축 값이 0–100 범위를 보장한다 (클램핑 포함)
- [x] `axisFeedbacks`는 항상 8개 (8축 빠짐없이) 반환한다
- [x] `score >= 75`이면 `type="strength"` + 칭찬 피드백, `score < 75`이면 `type="improvement"` + 실행형 피드백
- [x] `growthCurve`는 항상 `null` 반환 (Phase 3 확장 포인트로 보존)
- [x] `engine/app/prompts/report_evaluation_v1.md` 파일이 버전 관리된다
- [x] `pytest` 전체 통과 (신규 단위 16개 + 통합 8개, 전체 86개)

## 구현 플랜

### Pydantic 스키마

```python
# schemas.py 추가

class AxisFeedback(BaseModel):
    axis: str                                      # "communication"
    axisLabel: str                                 # "의사소통"
    score: int = Field(..., ge=0, le=100)
    type: Literal["strength", "improvement"]
    feedback: str                                  # 칭찬 or 실행형 피드백 문장

class AxisScores(BaseModel):
    communication: int = Field(..., ge=0, le=100)
    problemSolving: int = Field(..., ge=0, le=100)
    logicalThinking: int = Field(..., ge=0, le=100)
    jobExpertise: int = Field(..., ge=0, le=100)
    cultureFit: int = Field(..., ge=0, le=100)
    leadership: int = Field(..., ge=0, le=100)
    creativity: int = Field(..., ge=0, le=100)
    sincerity: int = Field(..., ge=0, le=100)

class ReportRequest(BaseModel):
    resumeText: str = Field(..., min_length=1)
    history: list[HistoryItem] = Field(..., min_length=1)

class ReportResponse(BaseModel):
    scores: AxisScores
    totalScore: int = Field(..., ge=0, le=100)
    summary: str
    axisFeedbacks: list[AxisFeedback] = Field(..., min_length=8, max_length=8)
    growthCurve: None = None

# exceptions.py 추가
class InsufficientAnswersError(Exception): pass   # -> 422
class ReportParseError(LLMError): pass             # -> 500
```

### 축 피드백 구조 (점수 기반 톤 분기)

| 점수 | type | 피드백 방향 | 예시 |
|------|------|-----------|------|
| 75점 이상 | `strength` | 구체적 강점 칭찬 1–2문장 | "답변 구조가 명확하고 핵심을 먼저 전달하는 두괄식 화법이 인상적입니다." |
| 75점 미만 | `improvement` | 지금 바로 실천 가능한 실행형 문장 | "기존 방식과 다른 접근을 시도한 경험을 STAR 구조로 한 가지 준비해보세요." |

실행형 피드백 예시 (improvement):
- `"답변을 STAR(상황-과제-행동-결과) 구조로 정리해보세요."`
- `"'열심히 했습니다' 대신 '30% 개선'처럼 정량화된 결과를 포함해보세요."`
- `"팀 내에서 본인이 주도한 경험을 구체적 역할과 영향력 중심으로 한 가지 준비해보세요."`

### 신규 파일 목록

| 파일 | 책임 |
|------|------|
| `engine/app/routers/report.py` | `POST /api/report/generate` 엔드포인트 |
| `engine/app/services/report_service.py` | 리포트 생성 비즈니스 로직 |
| `engine/app/services/llm_client.py` | `_call_llm`, `_parse_object` 공통 추출 |
| `engine/app/prompts/report_evaluation_v1.md` | 8축 평가 + 피드백 프롬프트 템플릿 |
| `engine/tests/unit/services/test_report_service.py` | 단위 테스트 16개 |
| `engine/tests/integration/test_report_router.py` | 통합 테스트 8개 |
| `engine/tests/fixtures/output/mock_report_response.json` | LLM 응답 픽스처 |
| `engine/tests/fixtures/output/mock_history_5items.json` | 히스토리 5개 픽스처 |

### 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `engine/app/schemas.py` | `ReportRequest`, `AxisScores`, `AxisFeedback`, `ReportResponse` 추가 |
| `engine/app/parsers/exceptions.py` | `InsufficientAnswersError`, `ReportParseError` 추가 |
| `engine/app/main.py` | `report_router` 등록 + `InsufficientAnswersError` 핸들러 추가 |
| `engine/app/services/interview_service.py` | `_call_llm`, `_parse_object` -> `llm_client.py` import로 교체 |

### 단계별 구현 순서 (TDD: Red -> Green -> Refactor)

**1단계 — 스키마 + 예외 (RED 먼저)**

스키마 테스트 6개 먼저 작성 → ImportError RED 확인 → schemas.py 구현 → GREEN

**2단계 — 공통 LLM 클라이언트 추출**

`interview_service.py`의 `_call_llm`, `_parse_object` → `services/llm_client.py`로 이동.
`interview_service.py`에서 import로 교체 (기존 테스트 GREEN 유지 확인).

**3단계 — 프롬프트 작성 (`report_evaluation_v1.md`)**

```
각 축마다 아래 규칙으로 피드백을 생성하세요:
- score >= 75: type="strength", 구체적 강점을 1–2문장으로 칭찬
- score < 75:  type="improvement", 지원자가 바로 실천할 수 있는
               실행형 문장으로 작성
               (예: "답변을 STAR 구조로 정리해보세요",
                    "수치 없이 '열심히'라는 표현 대신 '30% 개선'처럼
                     정량화된 결과를 포함해보세요")

반드시 8축 전부 포함하여 axisFeedbacks 배열을 반환하세요.
```

**4단계 — `report_service.py` 구현**

```python
MIN_ANSWERS = 5

def generate_report(resumeText: str, history: list[HistoryItem], *, model=None) -> ReportResponse:
    if len(history) < MIN_ANSWERS:
        raise InsufficientAnswersError(f"최소 {MIN_ANSWERS}개 답변 필요. 현재 {len(history)}개.")
    prompt = _build_prompt(resumeText, history)
    raw = call_llm(prompt, model=model, timeout=60.0)
    return _parse_report(raw)

def _parse_report(raw: str) -> ReportResponse:
    # 1) JSON 파싱 실패 -> ReportParseError
    # 2) 누락 axis 값 -> 50점 fallback
    # 3) axisFeedbacks != 8개 -> ReportParseError
    # 4) 점수 클램핑: max(0, min(100, int(val)))
    # 5) score 기준으로 type 검증 (LLM 오분류 보정 가능)
```

**5단계 — 라우터 + main.py 등록**

**6단계 — Refactor**

파싱 로직 정리, 점수 클램핑 함수 추출, 프롬프트 빌더 분리.

### 에러 처리 전략

| 상황 | HTTP | 처리 |
|------|------|------|
| history < 5 | 422 | `InsufficientAnswersError` |
| 필수 필드 누락 | 400 | Pydantic `ValidationError` |
| LLM API 오류 | 500 | `LLMError` |
| JSON 파싱 실패 | 500 | `ReportParseError` |
| 일부 axis 누락 | 200 | 50점 fallback (부분 복구) |
| axisFeedbacks != 8개 | 500 | `ReportParseError` |

### 서비스 -> 엔진 통신 흐름

```
[클라이언트] -> POST /api/report/generate { sessionId }
  -> [Next.js] DB에서 sessionId로 history 조회
  -> [엔진] POST /api/report/generate { resumeText, history: HistoryItem[] }
  -> [엔진] LLM 호출 1회 -> scores + summary + axisFeedbacks(8개)
  -> [Next.js] 결과 DB 저장 후 클라이언트 응답
```

## 테스트 전략 (TDD)

### 단위 테스트 (16개) — `tests/unit/services/test_report_service.py`

**스키마 검증 (6개)**
- `test_report_request_valid`
- `test_report_request_history_too_short_raises_validation_error` (< 5)
- `test_report_request_history_exactly_5_is_valid`
- `test_report_request_empty_resume_raises_validation_error`
- `test_report_response_has_required_fields`
- `test_report_response_axis_feedbacks_count_is_8`

**서비스 로직 (10개)**
- `test_generate_report_returns_valid_response`
- `test_generate_report_axes_scores_within_range`
- `test_generate_report_total_score_within_range`
- `test_generate_report_axis_feedbacks_all_8_axes_present`
- `test_generate_report_high_score_axis_type_is_strength`
- `test_generate_report_low_score_axis_type_is_improvement`
- `test_generate_report_llm_api_error_raises_llm_error`
- `test_generate_report_invalid_json_raises_llm_error`
- `test_generate_report_score_clamped_when_out_of_range`
- `test_generate_report_insufficient_answers_raises_error`

모킹: `patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(content))`

### 통합 테스트 (8개) — `tests/integration/test_report_router.py`

- `test_generate_report_200_returns_8_axes`
- `test_generate_report_200_axis_feedbacks_count_is_8`
- `test_generate_report_200_scores_all_within_0_to_100`
- `test_generate_report_422_history_less_than_5` ← 계획 대비 상태코드 수정 (400→422)
- `test_generate_report_422_history_one_item` ← 계획 대비 이름 수정 (empty→one_item)
- `test_generate_report_400_missing_resume_text`
- `test_generate_report_400_missing_history`
- `test_generate_report_500_llm_error`

## 개발 체크리스트

- [x] 테스트 코드 포함 (단위 16개 + 통합 8개, 모두 GREEN)
- [x] 해당 디렉토리 `.ai.md` 최신화 (`engine/.ai.md`, `services/.ai.md`, `routers/.ai.md`, `tests/.ai.md`, `prompts/.ai.md`)
- [x] `engine/app/prompts/.ai.md` 최신화 (report_evaluation_v1.md 버전 기재)
- [x] 불변식 위반 없음 (stateless 유지, LLM 호출 services/ 에서만, DB 접근 없음)
- [x] `growthCurve: None` 고정 (Phase 3 확장 포인트)
- [x] `llm_client.py` 추출 후 기존 interview_service 테스트 전체 PASS 확인


---

## 작업 내역

### 2026-03-11 구현 완료

**생성 파일**
- `engine/app/services/llm_client.py` — 공통 LLM 호출 유틸리티 (`call_llm`, `parse_object`)
- `engine/app/services/report_service.py` — 리포트 생성 서비스 (`generate_report`)
- `engine/app/routers/report.py` — `POST /api/report/generate` 엔드포인트
- `engine/app/prompts/report_evaluation_v1.md` — 8축 평가 프롬프트 v1
- `engine/tests/unit/services/test_report_service.py` — 단위 테스트 16개
- `engine/tests/integration/test_report_router.py` — 통합 테스트 8개
- `engine/tests/fixtures/output/mock_report_response.json`
- `engine/tests/fixtures/output/mock_history_5items.json`
- `docs/work/active/000054-phase-2-engine/02_test.md` — 테스트 명세

**수정 파일**
- `engine/app/schemas.py` — `FeedbackType`, `AxisScores`, `AxisFeedback`, `ReportRequest`, `ReportResponse` 추가
- `engine/app/parsers/exceptions.py` — `InsufficientAnswersError`, `ReportParseError` 추가
- `engine/app/main.py` — `report_router` 등록, `InsufficientAnswersError` → 422 핸들러 추가
- `engine/app/services/interview_service.py` — `llm_client` import로 교체
- `engine/tests/unit/services/test_interview_service.py` — mock 경로 `llm_client`로 수정
- `engine/tests/integration/test_interview_router.py` — mock 경로 `llm_client`로 수정
- `.ai.md` 파일 5개 최신화 (engine, services, routers, tests, prompts)

**주요 설계 결정**
- 싱글 LLM 1회 호출 전략 (비용 ~7.5배 절감, 축간 일관성)
- `llm_client.py` 공통화: `call_llm(timeout, max_tokens, error_message)` 파라미터로 서비스별 커스텀
- `ReportParseError`는 `LLMError` 상속 → 기존 `handle_500` 핸들러 자동 처리
- `history=[]` → 400 (Pydantic), `history` 1~4개 → 422 (InsufficientAnswersError)
- `growthCurve: null` 고정 — Phase 3에서 서비스 레이어가 DB 조회 후 채움

