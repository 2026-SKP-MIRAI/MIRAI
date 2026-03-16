# 000090 — 테스트 결과

## 실행 환경

| 항목 | 값 |
|------|-----|
| 실행일 | 2026-03-16 |
| Python | 3.12.10 |
| pytest | 9.0.2 |

## 단위 테스트 — `tests/unit/services/test_feedback_service.py` (15개)

| # | 테스트 함수명 | 결과 |
|---|--------------|------|
| 1 | `test_generate_resume_feedback_returns_valid_response` | ✅ PASS |
| 2 | `test_generate_resume_feedback_scores_within_range` | ✅ PASS |
| 3 | `test_generate_resume_feedback_strengths_count` | ✅ PASS |
| 4 | `test_generate_resume_feedback_weaknesses_count` | ✅ PASS |
| 5 | `test_generate_resume_feedback_suggestions_structure` | ✅ PASS |
| 6 | `test_generate_resume_feedback_score_over_100_raises_parse_error` | ✅ PASS |
| 7 | `test_generate_resume_feedback_score_negative_raises_parse_error` | ✅ PASS |
| 8 | `test_generate_resume_feedback_strengths_truncated_to_3` | ✅ PASS |
| 9 | `test_generate_resume_feedback_weaknesses_truncated_to_3` | ✅ PASS |
| 10 | `test_generate_resume_feedback_empty_strengths_uses_fallback` | ✅ PASS |
| 11 | `test_generate_resume_feedback_llm_error_raises_llm_error` | ✅ PASS |
| 12 | `test_generate_resume_feedback_invalid_json_raises_parse_error` | ✅ PASS |
| 13 | `test_generate_resume_feedback_missing_scores_raises_parse_error` | ✅ PASS |
| 14 | `test_generate_resume_feedback_partial_scores_raises_parse_error` | ✅ PASS |
| 15 | `test_generate_resume_feedback_null_score_value_raises_parse_error` | ✅ PASS |

## 통합 테스트 — `tests/integration/test_resume_feedback_router.py` (9개)

| # | 테스트 함수명 | HTTP | 결과 |
|---|--------------|------|------|
| 1 | `test_resume_feedback_200_full_fields` | 200 | ✅ PASS |
| 2 | `test_resume_feedback_200_scores_five_keys` | 200 | ✅ PASS |
| 3 | `test_resume_feedback_400_missing_resume_text` | 400 | ✅ PASS |
| 4 | `test_resume_feedback_400_missing_target_role` | 400 | ✅ PASS |
| 5 | `test_resume_feedback_400_empty_resume_text` | 400 | ✅ PASS |
| 6 | `test_resume_feedback_400_empty_target_role` | 400 | ✅ PASS |
| 7 | `test_resume_feedback_500_llm_error` | 500 | ✅ PASS |
| 8 | `test_resume_feedback_500_parse_error` | 500 | ✅ PASS |
| 9 | `test_resume_feedback_200_empty_suggestions_uses_fallback` | 200 | ✅ PASS |

## 단위 테스트 — `tests/unit/services/test_report_service.py` (21개)

| # | 테스트 함수명 | 결과 |
|---|--------------|------|
| 1 | `test_report_request_valid` | ✅ PASS |
| 2 | `test_report_request_history_too_short_raises_validation_error` | ✅ PASS |
| 3 | `test_report_request_history_exactly_5_is_valid` | ✅ PASS |
| 4 | `test_report_request_empty_resume_raises_validation_error` | ✅ PASS |
| 5 | `test_report_response_has_required_fields` | ✅ PASS |
| 6 | `test_report_response_axis_feedbacks_count_is_8` | ✅ PASS |
| 7 | `test_generate_report_returns_valid_response` | ✅ PASS |
| 8 | `test_generate_report_axes_scores_within_range` | ✅ PASS |
| 9 | `test_generate_report_total_score_within_range` | ✅ PASS |
| 10 | `test_generate_report_axis_feedbacks_all_8_axes_present` | ✅ PASS |
| 11 | `test_generate_report_high_score_axis_type_is_strength` | ✅ PASS |
| 12 | `test_generate_report_low_score_axis_type_is_improvement` | ✅ PASS |
| 13 | `test_generate_report_llm_api_error_raises_llm_error` | ✅ PASS |
| 14 | `test_generate_report_invalid_json_raises_llm_error` | ✅ PASS |
| 15 | `test_generate_report_score_over_100_raises_parse_error` | ✅ PASS |
| 16 | `test_generate_report_score_negative_raises_parse_error` | ✅ PASS |
| 17 | `test_generate_report_missing_scores_raises_parse_error` | ✅ PASS |
| 18 | `test_generate_report_partial_scores_raises_parse_error` | ✅ PASS |
| 19 | `test_generate_report_null_score_value_raises_parse_error` | ✅ PASS |
| 20 | `test_generate_report_axis_feedback_score_over_100_raises_parse_error` | ✅ PASS |
| 21 | `test_generate_report_insufficient_answers_raises_error` | ✅ PASS |

## 통합 테스트 — `tests/integration/test_report_router.py` (9개)

| # | 테스트 함수명 | HTTP | 결과 |
|---|--------------|------|------|
| 1 | `test_generate_report_200_returns_8_axes` | 200 | ✅ PASS |
| 2 | `test_generate_report_200_axis_feedbacks_count_is_8` | 200 | ✅ PASS |
| 3 | `test_generate_report_200_scores_all_within_0_to_100` | 200 | ✅ PASS |
| 4 | `test_generate_report_422_history_less_than_5` | 422 | ✅ PASS |
| 5 | `test_generate_report_422_history_one_item` | 422 | ✅ PASS |
| 6 | `test_generate_report_400_missing_resume_text` | 400 | ✅ PASS |
| 7 | `test_generate_report_400_missing_history` | 400 | ✅ PASS |
| 8 | `test_generate_report_500_llm_error` | 500 | ✅ PASS |
| 9 | `test_generate_report_500_parse_error` | 500 | ✅ PASS |

## 전체 회귀 테스트

```
54 passed (단위 36 + 통합 18), 0 warnings
```

## 추가 개선 내역 (validate 과정에서 발견·수정)

| 항목 | 내용 |
|------|------|
| 이중 truncation 제거 | `generate_resume_feedback()`의 `resumeText[:16000]` 중복 제거 — `_build_prompt()` 한 곳에서만 수행 |
| shadowing 수정 | `_safe_list()` 내부 변수명 `raw` → `items` |
| suggestions min 보장 | `schemas.py` `min_length=1` 추가 + 빈 배열 시 fallback SuggestionItem 삽입 (테스트 9 추가) |
| scores 엄격 검증 (feedback) | 5개 키 누락/null → `ResumeFeedbackParseError` raise. silent 50점 fallback 제거 (테스트 13·14·15 추가) |
| scores 범위 검증 (feedback) | `_clamp()` 제거 → `_validate_score()` 도입 — 0~100 초과 시 `ResumeFeedbackParseError` raise (테스트 6·7 변경) |
| report_service 엄격 검증 | `_clamp()` 제거 → `_validate_score()` 도입 — scores 8개 키 누락/null/범위초과 → `ReportParseError` raise |
| report_service axisFeedbacks 검증 | 각 항목 score 범위 초과 시 `ReportParseError` raise (테스트 15~20 추가) |
| report 테스트 fixture 제거 | `test_report_service.py`, `test_report_router.py`에서 외부 JSON 파일 의존성 제거 → inline 헬퍼로 대체 |
| config.py extra 키 무시 | `extra="ignore"` 추가 — .env의 엔진 외 키(`replicate_api_key` 등) Pydantic ValidationError 방지 |
