# [#113] 테스트 결과 보고서

> 작성: 2026-03-19
> 브랜치: feat/000113-pdf-targetrole
> 최종 테스트 실행: `cd engine && python -m pytest -v` (fixture 누락 3개 파일 제외)

---

## 최종 결과

```
148 passed, 0 failed, 0 errors
실행 시간: 3.29s
```

---

## 신규 추가 테스트 (#113)

### 단위 테스트

#### `tests/unit/services/test_role_service.py` (9개)

| # | 테스트명 | 검증 내용 | 결과 |
|---|---------|---------|------|
| 1 | `test_extract_target_role_success` | "경영기획" 정상 반환 | PASS |
| 2 | `test_extract_target_role_strips_whitespace` | "  백엔드  " → "백엔드" 트림 | PASS |
| 3 | `test_extract_target_role_fallback_when_empty` | targetRole="" → "미지정" | PASS |
| 4 | `test_extract_target_role_fallback_when_null` | targetRole=null → "미지정" | PASS |
| 5 | `test_extract_target_role_raises_when_resume_text_is_empty` | 빈 문자열 → LLMError | PASS |
| 6 | `test_extract_target_role_raises_when_resume_text_is_whitespace` | 공백 문자열 → LLMError | PASS |
| 7 | `test_extract_target_role_api_error` | LLM API 오류 → LLMError 전파 | PASS |
| 8 | `test_extract_target_role_truncates_long_text` | 16,000자 초과 입력 → 프롬프트에 16,001자 이상 미삽입 | PASS |
| 9 | `test_extract_target_role_truncates_output_to_100` | LLM이 120자 반환 → 100자로 트런케이션 | PASS |

#### `tests/unit/services/test_feedback_service.py` — 추가 2개 (총 19개)

| # | 테스트명 | 검증 내용 | 결과 |
|---|---------|---------|------|
| 18 | `test_generate_resume_feedback_none_target_role_uses_default_label` | target_role=None → 프롬프트에 "미지정 직무" 포함 | PASS |
| 19 | `test_generate_resume_feedback_empty_target_role_uses_default_label` | target_role="" → 프롬프트에 "미지정 직무" 포함 | PASS |

#### `tests/unit/services/test_llm_service.py` — 추가 2개 (총 7개)

| # | 테스트명 | 검증 내용 | 결과 |
|---|---------|---------|------|
| 6 | `test_generate_questions_with_target_role_injects_prompt` | target_role 전달 시 프롬프트에 직무명 포함 | PASS |
| 7 | `test_generate_questions_without_target_role_no_injection` | target_role 미전달 시 "지원 직무가" postfix 없음 | PASS |

### 통합 테스트

#### `tests/integration/test_resume_target_role_route.py` (5개)

| # | 테스트명 | HTTP | 결과 |
|---|---------|------|------|
| 1 | `test_200_target_role_success` | 200, `{"targetRole": "경영기획"}` | PASS |
| 2 | `test_200_target_role_fallback_when_undetectable` | 200, `{"targetRole": "미지정"}` | PASS |
| 3 | `test_400_missing_resume_text` | 400 | PASS |
| 4 | `test_400_empty_resume_text` | 400 | PASS |
| 5 | `test_500_llm_error` | 500 | PASS |

#### `tests/integration/test_resume_analyze_route.py` (7개)

| # | 테스트명 | HTTP | 결과 |
|---|---------|------|------|
| 1 | `test_200_analyze_success` | 200, `{resumeText, extractedLength, targetRole}` | PASS |
| 2 | `test_200_analyze_target_role_fallback` | 200, targetRole="미지정" | PASS |
| 3 | `test_400_no_file` | 400 | PASS |
| 4 | `test_400_non_pdf` | 400 | PASS |
| 5 | `test_500_llm_error` | 500 (파싱 성공, LLM 실패) | PASS |
| 6 | `test_422_empty_pdf` | 422 (EmptyPDFError) | PASS |
| 7 | `test_422_image_only_pdf` | 422 (ImageOnlyPDFError) | PASS |

#### `tests/integration/test_resume_feedback_router.py` — 변경 테스트

| # | 테스트명 | 변경 내용 | HTTP | 결과 |
|---|---------|---------|------|------|
| - | `test_resume_feedback_200_missing_target_role` | targetRole 미입력 → 200 (optional) | 200 | PASS |
| - | `test_resume_feedback_200_empty_target_role` | targetRole="" → 200 ("미지정 직무") | 200 | PASS |

#### `tests/integration/test_resume_questions_route.py` — 추가 3개 (총 10개)

| # | 테스트명 | HTTP | 결과 |
|---|---------|------|------|
| 8 | `test_200_with_target_role` | 200, targetRole 전달 시 정상 응답 | PASS |
| 9 | `test_200_with_empty_target_role` | 200, targetRole="" → None과 동일 처리 | PASS |
| 10 | `test_400_target_role_too_long` | 400, targetRole 101자("a"×101) | PASS |

#### `tests/integration/test_resume_target_role_route.py` — 추가 2개 (총 7개)

| # | 테스트명 | HTTP | 결과 |
|---|---------|------|------|
| 6 | `test_400_resume_text_too_long` | 400, resumeText 50,001자 | PASS |
| 7 | `test_200_resume_text_max_length` | 200, resumeText 정확히 50,000자 (경계값) | PASS |

---

## 전체 테스트 스위트 현황

| 파일 | 테스트 수 | PASS |
|------|---------|------|
| `test_interview_router.py` | 11 | 11 |
| `test_resume_analyze_route.py` | 7 | 7 |
| `test_resume_feedback_router.py` | 9 | 9 |
| `test_resume_parse_route.py` | 11 | 11 |
| `test_resume_questions_route.py` | 10 | 10 |
| `test_resume_target_role_route.py` | 7 | 7 |
| `test_pdf_parser.py` | 14 | 14 |
| `test_feedback_service.py` | 19 | 19 |
| `test_interview_service.py` | 16 | 16 |
| `test_llm_client.py` | 3 | 3 |
| `test_llm_service.py` | 7 | 7 |
| `test_output_parser.py` | 11 | 11 |
| `test_practice_service.py` | 13 | 13 |
| `test_role_service.py` | 9 | 9 |
| **합계** | **148** | **148** |

> **제외 파일** (fixture 파일 부재 — 브랜치 환경 이슈, #113 범위 외):
> - `test_practice_router.py` — `mock_practice_feedback_single.json` 없음
> - `test_report_router.py` — `mock_report_response.json` 없음
> - `test_report_service.py` — `mock_report_response.json` 없음

---

## validate-all 검증 결과

| 실행 | CRITICAL | IMPORTANT | MEDIUM | LOW |
|------|---------|-----------|--------|-----|
| 1차 (구현 직후) | 0 | 6 | 6 | 4 |
| 2차 (이슈 수정 후) | 0 | 2 | 0 | 0 |
| 3차 (/questions targetRole 추가 후) | 0 | 0 | 0 | 0 |
| 4차 (코드리뷰 반영 — escape/scope/tests) | 0 | 0 | 0 | 0 |
| 5차 (MEDIUM/LOW 전수 수정 — llm_client None, 경계값 테스트, .ai.md) | 0 | 0 | 0 | 0 |

> 모든 IMPORTANT/MEDIUM/LOW 항목 수정 완료. 최종 CRITICAL 0개.

---

## 아키텍처 불변식 점검

| 불변식 | 상태 |
|--------|------|
| LLM 호출은 `services/`에서만 | ✅ |
| PDF 파싱은 `parsers/`에서만 | ✅ |
| 라우터는 서비스를 통해서만 LLM 호출 | ✅ |
| 테스트 없는 PR 금지 | ✅ (신규 코드 전체 커버) |
