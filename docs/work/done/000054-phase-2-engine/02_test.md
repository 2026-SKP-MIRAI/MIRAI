# [#54] feat: [Phase 2][Engine] 기능07 — 8축 역량 평가 리포트 엔진 구현 — 테스트

> 작성: 2026-03-11 | 총 86개 (신규 24 + 기존 62) | 플랜: `01_plan.md`

---

## 최종 결과

```
pytest tests/ -q
86 passed in X.XXs
```

전체 86개 통과. 리그레션(기존 62개 테스트) 포함.

---

## 상태 범례

| 아이콘 | 의미 |
|--------|------|
| ⬜ | 미구현 |
| 🔴 | RED — 테스트 작성 완료, 실패 확인 |
| 🟢 | GREEN — 구현 완료, 테스트 통과 |
| ✅ | DONE — 리팩토링 완료 |
| ❌ | FAIL — 테스트 실패 (수정 필요) |

---

## 테스트 파일 구조

```
engine/tests/
├── unit/
│   └── services/
│       └── test_report_service.py   ← 신규 (16개)
└── integration/
    └── test_report_router.py        ← 신규 (8개)
```

---

## 사이클 1 — 스키마 유효성

파일: `engine/tests/unit/services/test_report_service.py`

| # | 테스트명 | 상태 | 비고 |
|---|----------|------|------|
| 1 | `test_report_request_valid` | ✅ | `resumeText` + `history` 5개 → 정상 생성 |
| 2 | `test_report_request_history_too_short_raises_validation_error` | ✅ | `history=[]` → Pydantic `ValidationError` (400) |
| 3 | `test_report_request_history_exactly_5_is_valid` | ✅ | `history` 정확히 5개 → 유효 |
| 4 | `test_report_request_empty_resume_raises_validation_error` | ✅ | `resumeText=""` → Pydantic `ValidationError` (400) |
| 5 | `test_report_response_has_required_fields` | ✅ | `scores`, `totalScore`, `summary`, `axisFeedbacks`, `growthCurve` 필드 존재 확인 |
| 6 | `test_report_response_axis_feedbacks_count_is_8` | ✅ | `axisFeedbacks` 정확히 8개 |

---

## 사이클 2 — 서비스 단위 테스트 (LLM mock)

파일: `engine/tests/unit/services/test_report_service.py`

mock 패치 경로: `"app.services.llm_client.OpenAI"`

> **주의**: Phase 2에서 `llm_client.py`를 공통화하면서 기존 interview 테스트 mock 경로도
> `app.services.interview_service.OpenAI` → `app.services.llm_client.OpenAI`로 일괄 변경.

| # | 테스트명 | 상태 | 비고 |
|---|----------|------|------|
| 7 | `test_generate_report_returns_valid_response` | ✅ | LLM mock → `ReportResponse` 정상 반환 |
| 8 | `test_generate_report_axes_scores_within_range` | ✅ | 8개 축 점수 모두 0–100 범위 |
| 9 | `test_generate_report_total_score_within_range` | ✅ | `totalScore` 0–100 범위 |
| 10 | `test_generate_report_axis_feedbacks_all_8_axes_present` | ✅ | `axisFeedbacks`에 8축 키 전부 포함 |
| 11 | `test_generate_report_high_score_axis_type_is_strength` | ✅ | `score >= 75` → `type="strength"` |
| 12 | `test_generate_report_low_score_axis_type_is_improvement` | ✅ | `score < 75` → `type="improvement"` |
| 13 | `test_generate_report_llm_api_error_raises_llm_error` | ✅ | LLM API 예외 → `LLMError` 발생 |
| 14 | `test_generate_report_invalid_json_raises_llm_error` | ✅ | LLM 응답이 JSON 아님 → `LLMError` (`ReportParseError`) 발생 |
| 15 | `test_generate_report_score_clamped_when_out_of_range` | ✅ | score=150 → 100, score=-10 → 0 클램핑 |
| 16 | `test_generate_report_insufficient_answers_raises_error` | ✅ | `history` 4개 → `InsufficientAnswersError` 발생 |

---

## 사이클 3 — 라우터 통합 테스트

파일: `engine/tests/integration/test_report_router.py`

### `POST /api/report/generate`

| # | 테스트명 | 상태 | 비고 |
|---|----------|------|------|
| 17 | `test_generate_report_200_returns_8_axes` | ✅ | HTTP 200 + `axisFeedbacks` 8개 |
| 18 | `test_generate_report_200_axis_feedbacks_count_is_8` | ✅ | 8축 키 중복 없이 전부 존재 |
| 19 | `test_generate_report_200_scores_all_within_0_to_100` | ✅ | 8축 점수 + `totalScore` 모두 0–100 |
| 20 | `test_generate_report_422_history_less_than_5` | ✅ | `history` 4개 → HTTP 422 (`InsufficientAnswersError`) |
| 21 | `test_generate_report_422_history_one_item` | ✅ | `history` 1개 → HTTP 422 (`InsufficientAnswersError`) |
| 22 | `test_generate_report_400_missing_resume_text` | ✅ | `resumeText` 필드 누락 → HTTP 400 |
| 23 | `test_generate_report_400_missing_history` | ✅ | `history` 필드 누락 → HTTP 400 |
| 24 | `test_generate_report_500_llm_error` | ✅ | LLM API 오류 → HTTP 500 |

> `history=[]`는 Pydantic `min_length=1`에 걸려 HTTP 400 처리됨 (422 아님).
> 1~4개만 서비스 레이어에서 `InsufficientAnswersError` → 422.

---

## 기존 테스트 리그레션 확인

| 파일 | 테스트 수 | 상태 | 비고 |
|------|-----------|------|------|
| `tests/unit/parsers/test_pdf_parser.py` | 7 | ✅ | |
| `tests/unit/services/test_llm_service.py` | 8 | ✅ | |
| `tests/unit/services/test_output_parser.py` | 10 | ✅ | |
| `tests/integration/test_resume_questions_route.py` | 9 | ✅ | |
| `tests/unit/services/test_interview_service.py` | 17 | ✅ | mock 경로 변경 적용 |
| `tests/integration/test_interview_router.py` | 11 | ✅ | mock 경로 변경 적용 |
| `tests/unit/services/test_report_service.py` | **16** | ✅ | 신규 |
| `tests/integration/test_report_router.py` | **8** | ✅ | 신규 |
| **합계** | **86** | ✅ | |

---

## 커버리지 정성 평가

| 케이스 | 테스트 여부 |
|--------|------------|
| 정상 응답 (200) | ✅ 통합 3개 |
| 필수 필드 누락 (400) | ✅ 통합 2개 |
| `history=[]` (400, Pydantic) | ✅ 단위 스키마 테스트 |
| `history` 1~4개 (422, `InsufficientAnswersError`) | ✅ 통합 2개 + 단위 1개 이중 검증 |
| LLM API 오류 (500) | ✅ 통합 1개 + 단위 1개 이중 검증 |
| JSON 파싱 실패 (500, `ReportParseError`) | ✅ 단위 1개 |
| 축 점수 클램핑 (0–100 범위 강제) | ✅ 단위 1개 |
| `score >= 75` → `type="strength"` | ✅ 단위 1개 |
| `score < 75` → `type="improvement"` | ✅ 단위 1개 |
| `axisFeedbacks` 정확히 8개 | ✅ 단위 + 통합 이중 검증 |
| `growthCurve` 항상 `null` | ✅ 단위 스키마 테스트 |
| `totalScore` 서버 계산 (8축 평균) | ✅ 통합 (0–100 범위 검증) |

---

## 모킹 전략

```python
# LLM 성공 mock
patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_REPORT_JSON))

# LLM 실패 mock
fake = MagicMock()
fake.chat.completions.create.side_effect = Exception("API 오류")
patch("app.services.llm_client.OpenAI", return_value=fake)
```

- 모든 서비스(`interview_service`, `report_service`)가 `llm_client.py`를 통해 LLM 호출
- mock 경로: `app.services.llm_client.OpenAI` (단일 경로 — `llm_client` 공통화로 통일)

---

## 픽스처

| 파일 | 용도 |
|------|------|
| `engine/tests/fixtures/output/mock_report_response.json` | 8축 리포트 LLM 응답 mock 데이터 |
| `engine/tests/fixtures/output/mock_history_5items.json` | 면접 히스토리 5개 mock 데이터 |

---

## 에러 처리 검증 매트릭스

| 상황 | 예외 | HTTP | 테스트 |
|------|------|------|--------|
| `history` 1~4개 | `InsufficientAnswersError` | 422 | 통합 2개 + 단위 1개 |
| 필수 필드 누락 | Pydantic `ValidationError` | 400 | 통합 2개 |
| LLM API 오류 | `LLMError` | 500 | 통합 1개 + 단위 1개 |
| JSON 파싱 실패 | `ReportParseError` (`LLMError` 상속) | 500 | 단위 1개 |
| `axisFeedbacks != 8` | `ReportParseError` | 500 | (파싱 로직 내 처리) |
| 축 점수 범위 초과 | — | 200 (클램핑 처리) | 단위 1개 |

---

## 작업 로그

| 시각 | 내용 |
|------|------|
| 2026-03-11 | 스키마 + 예외 추가 (`AxisScores`, `AxisFeedback`, `ReportRequest`, `ReportResponse`, `InsufficientAnswersError`, `ReportParseError`) |
| 2026-03-11 | `llm_client.py` 공통화 — `call_llm(timeout, max_tokens, error_message)` 파라미터 추가 |
| 2026-03-11 | `interview_service.py` 리팩토링 — `llm_client` import 교체, 기존 테스트 회귀 GREEN 확인 |
| 2026-03-11 | 프롬프트 작성 (`report_evaluation_v1.md`) — 8축 싱글 LLM 호출, `score>=75` → strength 규칙 명시 |
| 2026-03-11 | `report_service.py` 구현 — 클램핑, type 강제 보정, totalScore 서버 계산 |
| 2026-03-11 | `report.py` 라우터 + `main.py` 등록 (`InsufficientAnswersError` → 422 핸들러 추가) |
| 2026-03-11 | 단위 16개 + 통합 8개 작성, 전체 86개 GREEN 확인 |
| 2026-03-11 | mock 경로 `interview_service.OpenAI` → `llm_client.OpenAI` 일괄 수정 (4개 파일) |
| 2026-03-11 | `.ai.md` 전체 최신화 (engine, services, routers, tests, prompts) + `async def` 설계 근거 추가 |
