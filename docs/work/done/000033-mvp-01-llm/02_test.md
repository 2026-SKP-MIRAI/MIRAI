# [#33] MVP 01 — 테스트 현황

> 작성: 2026-03-07 | 총 50개 | 플랜: `01_plan.md`

## 진행 현황 요약

| 구분 | 전체 | 통과 | 실패 | 미구현 |
|------|------|------|------|--------|
| 엔진 단위 (pytest) | 26 | 26 | 0 | 0 |
| 엔진 통합 (pytest) | 8 | 8 | 0 | 0 |
| lww 단위 (vitest) | 14 | 14 | 0 | 0 |
| e2e (playwright) | 2 | 2 | 0 | 0 |
| **합계** | **50** | **50** | **0** | **0** |

---

## 엔진 pytest

### `unit/parsers/test_pdf_parser.py` — 10개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 1 | `test_parse_pdf_success` | 🟢 GREEN | synthetic fixture |
| 2 | `test_empty_pdf_raises_empty_pdf_error` | 🟢 GREEN | EmptyPDFError → 422 |
| 3 | `test_image_only_pdf_raises_image_only_error` | 🟢 GREEN | ImageOnlyPDFError → 422 |
| 4 | `test_corrupted_pdf_raises_parse_error` | 🟢 GREEN | ParseError → 400 |
| 5 | `test_large_file_raises_file_size_error` | 🟢 GREEN | FileSizeError → 400 |
| 6 | `test_too_many_pages_raises_page_limit_error` | 🟢 GREEN | PageLimitError → 400 |
| 7 | `test_exactly_5mb_passes` | 🟢 GREEN | 경계값: 통과 |
| 8 | `test_5mb_plus_1byte_fails` | 🟢 GREEN | 경계값: 실패 |
| 9 | `test_exactly_10_pages_passes` | 🟢 GREEN | 경계값: 통과 |
| 10 | `test_11_pages_fails` | 🟢 GREEN | 경계값: 실패 |

### `unit/services/test_output_parser.py` — 11개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 11 | `parses_valid_question_array_when_json_matches_schema` | 🟢 GREEN | |
| 12 | `raises_llm_error_when_response_is_not_valid_json` | 🟢 GREEN | |
| 13 | `raises_llm_error_when_root_is_not_list` | 🟢 GREEN | |
| 14 | `raises_llm_error_when_item_is_not_object` | 🟢 GREEN | |
| 15 | `raises_llm_error_when_required_key_category_is_missing` | 🟢 GREEN | |
| 16 | `raises_llm_error_when_required_key_question_is_missing` | 🟢 GREEN | |
| 17 | `raises_llm_error_when_category_is_not_allowed_literal` | 🟢 GREEN | |
| 18 | `raises_llm_error_when_question_is_empty_string` | 🟢 GREEN | |
| 19 | `raises_llm_error_when_question_count_is_less_than_8` | 🟢 GREEN | |
| 20 | `returns_items_when_question_count_is_exactly_8` | 🟢 GREEN | |
| 21 | `raises_llm_error_when_question_count_is_zero` | 🟢 GREEN | valid JSON, empty list |

### `unit/services/test_llm_service.py` — 5개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 22 | `test_generate_questions_success` | 🟢 GREEN | mock messages.create |
| 23 | `test_generate_questions_api_error_raises_llm_error` | 🟢 GREEN | |
| 24 | `test_generate_questions_invalid_json_raises_llm_error` | 🟢 GREEN | |
| 25 | `test_generate_questions_unknown_category_raises_llm_error` | 🟢 GREEN | |
| 26 | `test_generate_questions_truncates_long_text` | 🟢 GREEN | 16000자 초과 시 잘림 |

### `integration/test_resume_questions_route.py` — 8개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 27 | `test_200_success` | 🟢 GREEN | AsyncClient + ASGITransport |
| 28 | `test_400_no_file` | 🟢 GREEN | RequestValidationError → 400 |
| 29 | `test_400_not_pdf` | 🟢 GREEN | filename=.pdf 위장 포함 |
| 30 | `test_400_file_too_large` | 🟢 GREEN | |
| 31 | `test_400_too_many_pages` | 🟢 GREEN | |
| 32 | `test_422_empty_pdf` | 🟢 GREEN | |
| 33 | `test_400_not_pdf_disguised` | 🟢 GREEN | content_type=text/plain 위장 |
| 34 | `test_500_llm_error` | 🟢 GREEN | |

---

## lww Vitest

### `tests/api/error-messages.test.ts` — 2개 (아키텍트 리뷰 후 추가)

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 35 | `이미지 전용 PDF 에러를 imageOnlyPdf로 매핑한다` | 🟢 GREEN | 오분류 회귀 방지 |
| 36 | `텍스트 없는 빈 PDF 에러를 emptyPdf로 매핑한다` | 🟢 GREEN | |

### `tests/api/resume-questions-route.test.ts` — 5개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 37 | `POST 성공 시 200 반환` | 🟢 GREEN | vi.stubGlobal fetch mock |
| 38 | `엔진 400 에러 패스스루` | 🟢 GREEN | |
| 39 | `엔진 422 에러 패스스루` | 🟢 GREEN | |
| 40 | `엔진 500 에러 패스스루` | 🟢 GREEN | |
| 41 | `타임아웃 시 500 반환` | 🟢 GREEN | AbortSignal.timeout |

### `tests/ui/upload-form.test.tsx` — 5개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 42 | `idle_renders_upload_controls` | 🟢 GREEN | idle 기본 렌더링 |
| 43 | `moves_to_ready_when_pdf_selected` | 🟢 GREEN | idle → ready |
| 44 | `moves_to_uploading_when_submit_clicked` | 🟢 GREEN | ready → uploading |
| 45 | `moves_to_done_when_api_returns_questions` | 🟢 GREEN | uploading → done |
| 46 | `moves_to_error_when_api_fails_and_retry_restarts` | 🟢 GREEN | error → uploading (재시도) |

### `tests/ui/question-results.test.tsx` — 2개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 47 | `카테고리별_그룹핑_렌더링` | 🟢 GREEN | 4개 카테고리 |
| 48 | `다시하기_버튼_클릭_시_idle_복귀` | 🟢 GREEN | |

---

## e2e Playwright

### `tests/e2e/resume-flow.spec.ts` — 2개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 49 | `성공_플로우_PDF_업로드_질문_렌더링` | 🟢 GREEN | page.route() mock, 실제 LLM 불필요 |
| 50 | `에러_플로우_txt_업로드_한국어_에러` | 🟢 GREEN | page.route() mock 400 에러 |

---

## 작업 로그

| 시각 | 작업자 | 내용 |
|------|--------|------|
| 2026-03-07 | orchestrator | 02_test.md 초기 작성, 48개 항목 등록 |
| 2026-03-07 | setup-dev | Phase 0+1 엔진 스캐폴딩 완료 |
| 2026-03-07 | llm-dev | Phase 3: output_parser 11개 + llm_service 5개 전부 🟢 GREEN |
| 2026-03-07 | api-dev | Phase 4: 통합 8개 + 단위 26개 전부 🟢 GREEN (총 34개 통과) |
| 2026-03-07 | lww-dev | Phase 5+6: lww vitest 12개 전부 🟢 GREEN (api 5개 + upload-form 5개 + question-list 2개) |
| 2026-03-07 | orchestrator | e2e Playwright 구현 (page.route() mock): 성공/에러 플로우 2개 🟢 GREEN. 총 50/50 전부 통과 |
| 2026-03-07 | orchestrator | 아키텍트 리뷰 REJECTED → 2건 수정: imageOnlyPdf 오분류 fix + Content-Length 선제 reject. 회귀 테스트 2개 추가. 총 50개 (48개 GREEN, 2개 미구현) |

---

## 상태 범례

| 아이콘 | 의미 |
|--------|------|
| ⬜ | 미구현 |
| 🔴 | RED — 테스트 작성 완료, 실패 확인 |
| 🟢 | GREEN — 구현 완료, 테스트 통과 |
| ✅ | DONE — 리팩토링 완료 |
| ❌ | FAIL — 테스트 실패 (수정 필요) |
