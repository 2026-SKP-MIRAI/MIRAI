# [#78] 연습 모드 즉각 피드백 엔진 — 테스트 현황

> 작성: 2026-03-12 | 총 18개 계획 (단위 13 + 통합 5) | 플랜: `01_plan.md`
>
> **현재 상태: 전체 GREEN — 18개 신규 + 89개 기존 = 107개 전체 통과**

## 진행 현황 요약

| 구분 | 전체 | 통과 | 실패 | 미구현 |
|------|------|------|------|--------|
| pytest 단위 (engine) | 13 | 13 | 0 | 0 |
| pytest 통합 (engine) | 5 | 5 | 0 | 0 |
| **합계** | **18** | **18** | **0** | **0** |
| 기존 회귀 | 89 | 89 | 0 | 0 |
| **전체** | **107** | **107** | **0** | **0** |

---

## pytest — 단위 테스트 (`engine/tests/unit/services/test_practice_service.py`)

| # | 함수명 | 상태 | 검증 내용 |
|---|--------|------|-----------|
| 1 | `test_generate_practice_feedback_returns_valid_response` | 🟢 GREEN | 단일 답변 정상 응답 구조 (score, feedback, keywords, improvedAnswerGuide) |
| 2 | `test_generate_practice_feedback_score_within_range` | 🟢 GREEN | score가 0–100 사이 정수 |
| 3 | `test_generate_practice_feedback_comparison_delta_none_without_previous` | 🟢 GREEN | previousAnswer=None → comparisonDelta=None |
| 4 | `test_generate_practice_feedback_comparison_delta_exists_with_previous` | 🟢 GREEN | previousAnswer 포함 → comparisonDelta 존재, scoreDelta int |
| 5 | `test_generate_practice_feedback_score_clamped_over_100` | 🟢 GREEN | LLM score=105 → 100으로 clamp |
| 6 | `test_generate_practice_feedback_score_clamped_negative` | 🟢 GREEN | LLM score=-5 → 0으로 clamp |
| 7 | `test_generate_practice_feedback_good_truncated_to_3` | 🟢 GREEN | feedback.good 4개 → 3개 슬라이싱 |
| 8 | `test_generate_practice_feedback_empty_good_uses_fallback` | 🟢 GREEN | feedback.good=[] → fallback 문자열 |
| 9 | `test_generate_practice_feedback_empty_guide_uses_fallback` | 🟢 GREEN | improvedAnswerGuide="" → fallback 문자열 |
| 10 | `test_generate_practice_feedback_llm_error_raises_llm_error` | 🟢 GREEN | LLM API 오류 → `LLMError` raise |
| 11 | `test_generate_practice_feedback_invalid_json_raises_parse_error` | 🟢 GREEN | 잘못된 JSON 응답 → `PracticeParseError` raise |
| 12 | `test_generate_practice_feedback_improve_truncated_to_3` | 🟢 GREEN | feedback.improve 4개 → 3개 슬라이싱 (AC #5) |
| 13 | `test_generate_practice_feedback_keywords_truncated_to_5` | 🟢 GREEN | keywords 6개 → 5개 슬라이싱 (AC #6) |

---

## pytest — 통합 테스트 (`engine/tests/integration/test_practice_router.py`)

| # | 함수명 | HTTP | 상태 | 검증 내용 |
|---|--------|------|------|-----------|
| 14 | `test_practice_feedback_200_single` | 200 | 🟢 GREEN | 단일 답변, comparisonDelta=null 확인 |
| 15 | `test_practice_feedback_200_with_previous_answer` | 200 | 🟢 GREEN | previousAnswer 포함, comparisonDelta 존재 확인 |
| 16 | `test_practice_feedback_400_missing_question` | 400 | 🟢 GREEN | question 필드 누락 |
| 17 | `test_practice_feedback_400_missing_answer` | 400 | 🟢 GREEN | answer 필드 누락 |
| 18 | `test_practice_feedback_500_llm_error` | 500 | 🟢 GREEN | LLM mock side_effect → 500 반환 |

---

## pytest 실행 결과 (2026-03-12)

```
============================= test session starts =============================
platform win32 -- Python 3.14.3, pytest-9.0.2
collected 107 items

tests/integration/test_practice_router.py        5 passed
tests/integration/test_report_router.py          8 passed
tests/integration/test_interview_router.py      11 passed
tests/integration/test_resume_questions_route.py 8 passed
tests/unit/parsers/test_pdf_parser.py           10 passed
tests/unit/services/test_interview_service.py   16 passed
tests/unit/services/test_llm_client.py           3 passed
tests/unit/services/test_llm_service.py          5 passed
tests/unit/services/test_output_parser.py       11 passed
tests/unit/services/test_practice_service.py    13 passed
tests/unit/services/test_report_service.py      17 passed

======================= 107 passed, 2 warnings in 1.46s =======================
```

---

## AC 대비 테스트 커버리지

| AC 항목 | 커버 테스트 # | 상태 |
|---------|-------------|------|
| `POST /api/practice/feedback` 존재·동작 | #14 | 🟢 |
| previousAnswer 없이 → 200 + comparisonDelta=null | #1, #3, #14 | 🟢 |
| previousAnswer 포함 → 200 + comparisonDelta 존재 | #4, #15 | 🟢 |
| score 0-100 정수, `_clamp()` 보정 | #2, #5, #6 | 🟢 |
| feedback.good/improve 각 1-3개, 슬라이싱+fallback | #7, #8, #12 | 🟢 |
| keywords 1-5개, 슬라이싱 | #13 | 🟢 |
| improvedAnswerGuide 비어있지 않음 | #9 | 🟢 |
| comparisonDelta null/존재 조건 | #3, #4 | 🟢 |
| 필수 필드 누락 → 400 | #16, #17 | 🟢 |
| LLM 호출 실패 → 500 | #10, #18 | 🟢 |
| `practice_feedback_v1.md` 버전 관리 | (파일 생성으로 충족) | 🟢 |
| pytest TDD 전체 통과 + 회귀 없음 | 전체 18개 + 기존 89개 | 🟢 |

---

## 검증팀 리뷰 결과 (2026-03-12)

3개 전문가 에이전트(code-reviewer, arch-reviewer, tdd-reviewer)가 `01_plan.md` 검증 후 발견 및 수정한 이슈:

| 등급 | 항목 | 수정 내용 |
|------|------|-----------|
| CRITICAL | `ComparisonDelta.improvements` min_length=1 vs 빈 리스트 → ValidationError | `Field(default_factory=list)`로 변경 |
| CRITICAL | feedback.improve 슬라이싱 테스트 누락 | 테스트 #12 추가 |
| CRITICAL | keywords 슬라이싱 테스트 누락 | 테스트 #13 추가 |
| WARNING | `engine/.ai.md` 예외 계층 트리 업데이트 누락 | 6단계에 명시 추가 |
| WARNING | `parsers/.ai.md`, `tests/.ai.md` 업데이트 목록 누락 | 6단계에 추가 |

아키텍처 불변식 5개 PASS, AC 12/12 커버 확인.

---

## 작업 로그

| 시각 | 내용 |
|------|------|
| 2026-03-12 | `01_plan.md` 초안 작성 — 아키텍쳐/TDD/서버 전문가 3인 협업 |
| 2026-03-12 | 검증팀 (code-reviewer, arch-reviewer, tdd-reviewer) 플랜 검증 |
| 2026-03-12 | CRITICAL 3건 발견 → `01_plan.md` 수정 반영 (테스트 13개로 확정) |
| 2026-03-12 | `02_test.md` 작성 — 구현 전 상태, 18개 테스트 미구현 |
| 2026-03-12 | worker-3: 18개 테스트 작성 + pytest 실행 → 107/107 전체 GREEN |

---

## 상태 범례

| 아이콘 | 의미 |
|--------|------|
| ⬜ | 미구현 |
| 🔴 | RED — 테스트 작성 완료, 실패 확인 |
| 🟢 | GREEN — 구현 완료, 테스트 통과 |
| ✅ | DONE — 리팩토링 완료 |
| ❌ | FAIL — 테스트 실패 (수정 필요) |
