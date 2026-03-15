# 000090 — 테스트 결과

## 실행 환경

| 항목 | 값 |
|------|-----|
| 실행일 | 2026-03-13 |
| Python | 3.12.10 |
| pytest | 9.0.2 |

## 단위 테스트 — `tests/unit/services/test_feedback_service.py` (12개)

| # | 테스트 함수명 | 결과 |
|---|--------------|------|
| 1 | `test_generate_resume_feedback_returns_valid_response` | ✅ PASS |
| 2 | `test_generate_resume_feedback_scores_within_range` | ✅ PASS |
| 3 | `test_generate_resume_feedback_strengths_count` | ✅ PASS |
| 4 | `test_generate_resume_feedback_weaknesses_count` | ✅ PASS |
| 5 | `test_generate_resume_feedback_suggestions_structure` | ✅ PASS |
| 6 | `test_generate_resume_feedback_score_clamped_over_100` | ✅ PASS |
| 7 | `test_generate_resume_feedback_score_clamped_negative` | ✅ PASS |
| 8 | `test_generate_resume_feedback_strengths_truncated_to_3` | ✅ PASS |
| 9 | `test_generate_resume_feedback_weaknesses_truncated_to_3` | ✅ PASS |
| 10 | `test_generate_resume_feedback_empty_strengths_uses_fallback` | ✅ PASS |
| 11 | `test_generate_resume_feedback_llm_error_raises_llm_error` | ✅ PASS |
| 12 | `test_generate_resume_feedback_invalid_json_raises_parse_error` | ✅ PASS |

## 통합 테스트 — `tests/integration/test_resume_feedback_router.py` (8개)

| # | 테스트 함수명 | 결과 |
|---|--------------|------|
| 1 | `test_resume_feedback_200_full_fields` | ✅ PASS |
| 2 | `test_resume_feedback_200_scores_five_keys` | ✅ PASS |
| 3 | `test_resume_feedback_400_missing_resume_text` | ✅ PASS |
| 4 | `test_resume_feedback_400_missing_target_role` | ✅ PASS |
| 5 | `test_resume_feedback_400_empty_resume_text` | ✅ PASS |
| 6 | `test_resume_feedback_400_empty_target_role` | ✅ PASS |
| 7 | `test_resume_feedback_500_llm_error` | ✅ PASS |
| 8 | `test_resume_feedback_500_parse_error` | ✅ PASS |

## 전체 회귀 테스트

```
98 passed, 1 warning (기존 fixture 미싱 3개 제외 — 이슈 #90 범위 외)
```

> 기존 `test_report_router.py`, `test_practice_router.py`, `test_report_service.py`는
> `fixtures/output/` JSON 파일 미싱으로 수집 오류 발생. 이슈 #90 범위 외 기존 문제.
