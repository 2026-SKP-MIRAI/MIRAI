# 000090 — 테스트 결과

## 실행 환경

| 항목 | 값 |
|------|-----|
| 실행일 | 2026-03-16 |
| Python | 3.12.10 |
| pytest | 9.0.2 |

## 단위 테스트 — `tests/unit/services/test_feedback_service.py` (17개)

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
| 10 | `test_generate_resume_feedback_empty_strengths_raises_parse_error` | ✅ PASS |
| 11 | `test_generate_resume_feedback_llm_error_raises_llm_error` | ✅ PASS |
| 12 | `test_generate_resume_feedback_invalid_json_raises_parse_error` | ✅ PASS |
| 13 | `test_generate_resume_feedback_missing_scores_raises_parse_error` | ✅ PASS |
| 14 | `test_generate_resume_feedback_partial_scores_raises_parse_error` | ✅ PASS |
| 15 | `test_generate_resume_feedback_null_score_value_raises_parse_error` | ✅ PASS |
| 16 | `test_generate_resume_feedback_empty_weaknesses_raises_parse_error` | ✅ PASS |
| 17 | `test_generate_resume_feedback_empty_suggestions_raises_parse_error` | ✅ PASS |

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
| 9 | `test_resume_feedback_500_empty_suggestions_raises_error` | 500 | ✅ PASS |

## 전체 회귀 테스트

```
26 passed (단위 17 + 통합 9), 0 warnings
```

## 추가 개선 내역 (validate 과정에서 발견·수정)

| 항목 | 내용 |
|------|------|
| 이중 truncation 제거 | `generate_resume_feedback()`의 `resumeText[:16000]` 중복 제거 — `_build_prompt()` 한 곳에서만 수행 |
| scores 엄격 검증 | 5개 키 누락/null → `ResumeFeedbackParseError` raise. silent 50점 fallback 제거 (테스트 13·14·15 추가) |
| scores 범위 검증 | `_clamp()` 제거 → `_validate_score()` 도입 — 0~100 초과 시 `ResumeFeedbackParseError` raise (테스트 6·7 변경) |
| strengths/weaknesses 엄격 검증 | `_safe_list()` 제거 → `_require_str_list()` 도입 — 2개 미만 시 `ResumeFeedbackParseError` raise. fallback 삽입 없음 (테스트 10 변경, 테스트 16 추가) |
| suggestions 엄격 검증 | 빈 배열 시 `ResumeFeedbackParseError` raise. fallback SuggestionItem 삽입 없음 (테스트 17 추가, 통합 테스트 9 변경) |
| config.py extra 키 무시 | `extra="ignore"` 추가 — .env의 엔진 외 키 Pydantic ValidationError 방지 |
