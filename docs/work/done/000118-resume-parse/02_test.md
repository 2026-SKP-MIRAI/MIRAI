# [#118] 테스트 결과

> 작성: 2026-03-18 / 환경: Python 3.12.10, pytest 9.0.2, Tesseract 5.4.0, Windows 11

---

## 요약

| 구분 | 결과 |
|------|------|
| 전체 수집 | 143개 |
| PASS | **143개** |
| SKIP | **0개** |
| FAIL | **0개** |
| WARNING | 1개 (Pydantic 2.11 deprecation, 동작 영향 없음) |

---

## 이슈 #118 신규 테스트 (14개)

### `tests/integration/test_resume_parse_route.py` — `/api/resume/parse` (9개)

| # | 테스트명 | 결과 | 검증 내용 |
|---|---------|------|---------|
| 1 | `test_parse_200_success` | ✅ PASS | 200, resumeText + extractedLength 반환, extractedLength == len(resumeText) |
| 2 | `test_parse_200_ocr_pdf` | ✅ PASS | 이미지 PDF → OCR → 200, resumeText 비어있지 않음 |
| 3 | `test_parse_400_no_file` | ✅ PASS | 파일 없음 → 400 |
| 4 | `test_parse_400_not_pdf` | ✅ PASS | text/plain 파일 → 400 |
| 5 | `test_parse_400_not_pdf_disguised` | ✅ PASS | filename=.pdf + content_type=text/plain (MIME 위장) → 400 |
| 6 | `test_parse_400_file_too_large` | ✅ PASS | 5MB+1byte → 400 |
| 7 | `test_parse_400_too_many_pages` | ✅ PASS | 11페이지 PDF → 400 |
| 8 | `test_parse_422_empty_pdf` | ✅ PASS | 텍스트 없는 빈 PDF → 422 |
| 9 | `test_parse_422_unreadable_image_pdf` | ✅ PASS | OCR 판독 불가 이미지 PDF (1×1 픽셀) → 422 |

### `tests/integration/test_resume_questions_route.py` — `/api/resume/questions` JSON 전환 (5개)

| # | 테스트명 | 결과 | 검증 내용 |
|---|---------|------|---------|
| 1 | `test_200_success` | ✅ PASS | JSON body 수신, 200, questions + meta 반환 |
| 2 | `test_200_meta_extracted_length` | ✅ PASS | meta.extractedLength == len(resumeText) |
| 3 | `test_400_missing_resume_text` | ✅ PASS | resumeText 필드 누락 → 400 |
| 4 | `test_400_empty_resume_text` | ✅ PASS | resumeText = "" → 400 |
| 5 | `test_500_llm_error` | ✅ PASS | LLM API 오류 → 500 |

---

## 기존 테스트 회귀 (129개)

### `tests/integration/` (34개)

| 파일 | 결과 | 개수 |
|------|------|------|
| `test_interview_router.py` | ✅ 전부 PASS | 11개 |
| `test_practice_router.py` | ✅ 전부 PASS | 5개 |
| `test_report_router.py` | ✅ 전부 PASS | 8개 |
| `test_resume_feedback_router.py` | ✅ 전부 PASS | 9개 |

### `tests/unit/parsers/` (14개)

| 파일 | 결과 | 개수 |
|------|------|------|
| `test_pdf_parser.py` | ✅ 전부 PASS | 14개 |

### `tests/unit/services/` (81개)

| 파일 | 결과 | 개수 |
|------|------|------|
| `test_feedback_service.py` | ✅ 전부 PASS | 18개 |
| `test_interview_service.py` | ✅ 전부 PASS | 16개 |
| `test_llm_client.py` | ✅ 전부 PASS | 3개 |
| `test_llm_service.py` | ✅ 전부 PASS | 5개 |
| `test_output_parser.py` | ✅ 전부 PASS | 11개 |
| `test_practice_service.py` | ✅ 전부 PASS | 13개 |
| `test_report_service.py` | ✅ 전부 PASS | 17개 |

---

## 사전 작업 (테스트 실행 전 처리)

### Tesseract PATH 추가
Tesseract 5.4.0이 `C:\Program Files\Tesseract-OCR\`에 설치돼 있었으나 PATH에 없었음.
```bash
export PATH="$PATH:/c/Program Files/Tesseract-OCR"
```

### fixture 파일 추가
`tests/fixtures/` 디렉토리 및 하위 파일들이 미커밋 상태였음 (main에도 없음). 이슈 #28 준비 파일(`.gitignore` 대상 PDF, JSON)을 복사 + 누락 JSON 신규 생성.

**`tests/fixtures/input/`** (이슈 #28 제공 PDF)

| 파일 | 용도 |
|------|------|
| `sample_resume.pdf` | `sample_pdf_bytes` 픽스처용 실제 이력서 PDF |
| `empty.pdf` | 빈 PDF 테스트용 |
| `corrupted.pdf` | 손상 PDF 테스트용 |
| `image_only.pdf` | 이미지 전용 PDF 테스트용 |
| `large_file.pdf` | 5MB 초과 테스트용 |
| `many_pages.pdf` | 10페이지 초과 테스트용 |

**`tests/fixtures/output/`** (이슈 #28 제공 JSON + 신규 생성)

| 파일 | 출처 | 용도 |
|------|------|------|
| `mock_llm_response.json` | 이슈 #28 제공 | LLM 질문 생성 응답 모킹 (12개 질문) |
| `expected_parsed.json` | 이슈 #28 제공 | PDF 파싱 결과 기대값 |
| `mock_report_response.json` | 신규 생성 | 리포트 LLM 응답 모킹 (`totalScore` 포함) |
| `mock_history_5items.json` | 신규 생성 | 면접 히스토리 5개 픽스처 |
| `mock_practice_feedback_single.json` | 신규 생성 | 연습 피드백 단일 응답 모킹 |
| `mock_practice_feedback_retry.json` | 신규 생성 | 연습 피드백 재답변 응답 모킹 |

---

## WARNING

```
tests/unit/services/test_report_service.py::test_generate_report_axes_scores_within_range
  PydanticDeprecatedSince211: Accessing the 'model_fields' attribute on the instance is deprecated.
  Instead, you should access this attribute from the model class.
  Deprecated in Pydantic V2.11 to be removed in V3.0.
```

`result.scores.model_fields` → `result.scores.__class__.model_fields`로 수정하면 해소되나, 동작 영향 없음. #118 범위 밖 (test_report_service.py는 이번 PR 변경 파일이 아님).

---

## 실행 명령

```bash
# Tesseract PATH 추가 후 전체 실행
export PATH="$PATH:/c/Program Files/Tesseract-OCR"
python -m pytest -v
```
