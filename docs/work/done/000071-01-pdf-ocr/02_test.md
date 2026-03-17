# [#71] PDF 파서 OCR — 테스트 결과

> 실행일: 2026-03-17 | 환경: Windows 11 + Python 3.12.10 + PyMuPDF 1.27.1 + Tesseract 5.4.0.20240606

---

## 테스트 요약

| 구분 | Passed | Skipped | Failed | 합계 |
|------|--------|---------|--------|------|
| 단위 (parsers) | 14 | 0 | 0 | 14 |
| 통합 (resume_questions) | 9 | 0 | 0 | 9 |
| **합계** | **23** | **0** | **0** | **23** |

- Tesseract 5.4.0 설치 후 전체 23개 PASS, skip 0개
- 실행 시간: 1.26s
- 중복 테스트 제거: `test_empty_pdf_no_images_raises_empty_pdf_error` 삭제 (24 → 23개)

---

## 단위 테스트: `tests/unit/parsers/test_pdf_parser.py`

### 기존 테스트 (9개 — 회귀 없음)

| # | 테스트 | 결과 |
|---|--------|------|
| 1 | `test_parse_pdf_success` | PASSED |
| 2 | `test_empty_pdf_raises_empty_pdf_error` | PASSED |
| 3 | `test_corrupted_pdf_raises_parse_error` | PASSED |
| 4 | `test_large_file_raises_file_size_error` | PASSED |
| 5 | `test_too_many_pages_raises_page_limit_error` | PASSED |
| 6 | `test_exactly_5mb_passes` | PASSED |
| 7 | `test_5mb_plus_1byte_fails` | PASSED |
| 8 | `test_exactly_10_pages_passes` | PASSED |
| 9 | `test_11_pages_fails` | PASSED |

### 신규 OCR 테스트 (5개)

| # | 테스트 | AC | 결과 | 설명 |
|---|--------|----|------|------|
| 10 | `test_ocr_extracts_text_from_image_pdf` | AC1 | PASSED | 이미지 PDF → OCR → ParsedResume 반환, "Hello"/"OCR"/"Test"/"Resume" 포함 |
| 11 | `test_ocr_empty_result_raises_image_only_error` | AC3 | PASSED | 1x1 픽셀 이미지 → ImageOnlyPDFError 검증 |
| 12 | `test_ocr_not_run_when_text_exists` | AC2 | PASSED | 텍스트+이미지 혼합 PDF → OCR 미호출 확인 (mock) |
| 13 | `test_ocr_internal_error_raises_image_only_error` | AC3 | PASSED | `_ocr_fallback` 반환값 "" → ImageOnlyPDFError 확인 |
| 14 | `test_ocr_fallback_returns_empty_on_exception` | AC3 | PASSED | `_ocr_fallback` 내부 예외 → 빈 문자열 반환 직접 검증 |

---

## 통합 테스트: `tests/integration/test_resume_questions_route.py`

### 기존 테스트 (8개 — 회귀 없음)

| # | 테스트 | 결과 |
|---|--------|------|
| 1 | `test_200_success` | PASSED |
| 2 | `test_400_no_file` | PASSED |
| 3 | `test_400_not_pdf` | PASSED |
| 4 | `test_400_not_pdf_disguised` | PASSED |
| 5 | `test_400_file_too_large` | PASSED |
| 6 | `test_400_too_many_pages` | PASSED |
| 7 | `test_422_empty_pdf` | PASSED |
| 8 | `test_500_llm_error` | PASSED |

### 신규 OCR 통합 테스트 (1개)

| # | 테스트 | AC | 결과 | 설명 |
|---|--------|----|------|------|
| 9 | `test_200_ocr_pdf_success` | AC1, AC5 | PASSED | 이미지 PDF → 200 + questions 응답 검증 |

---

## AC ↔ 테스트 매핑

| AC | 요구사항 | 커버하는 테스트 | 상태 |
|----|----------|----------------|------|
| AC1 | 이미지 PDF → OCR → ParsedResume | `test_ocr_extracts_text_from_image_pdf`, `test_200_ocr_pdf_success` | COVERED (Tesseract 환경에서 검증) |
| AC2 | 기존 텍스트 PDF 무영향 | `test_ocr_not_run_when_text_exists` + 기존 10개 단위 테스트 | PASSED |
| AC3 | OCR 실패 → ImageOnlyPDFError(422) | `test_ocr_empty_result_raises_image_only_error`, `test_ocr_internal_error_raises_image_only_error`, `test_ocr_fallback_returns_empty_on_exception` | PASSED |
| AC4 | 합성 픽스처 + TDD | `conftest.py` 런타임 합성 + Red→Green 순서 | COVERED |
| AC5 | ParsedResume 스키마 불변 | `schemas.py` 미수정 + `test_200_ocr_pdf_success` | COVERED |

---

## 검증 결과 (4라운드, 총 12회 검증)

### 라운드 1 (3개 병렬)

| 검증 유형 | 결과 |
|-----------|------|
| 아키텍처 | **PASS** |
| 백엔드 | **PASS** |
| 서비스 | **PASS** |

### 라운드 2 — 엄격 모드 (3개 병렬)

| 검증 유형 | 결과 | 발견 이슈 | 수정 여부 |
|-----------|------|-----------|-----------|
| 아키텍처 | **PASS** | IMPORTANT 3 / MINOR 5 | 전부 수정 |
| 테스트 품질 | **PASS** | CRITICAL 2 / IMPORTANT 7 | 전부 수정 |
| Docker/배포 | **PASS** | CRITICAL 2 / IMPORTANT 3 | 전부 수정 |

### 라운드 2에서 수정한 항목

| 이슈 | 수정 내용 |
|------|-----------|
| `fitz.Document` 리소스 누수 | `with doc:` 컨텍스트 매니저 적용 |
| `_ocr_fallback` 로깅 없음 | `logger.warning("OCR fallback failed", exc_info=True)` 추가 |
| DPI 상수화 안 됨 | `_OCR_DPI = 300` 모듈 상수 + 메모리 코멘트 |
| `import shutil` 파일 중간 위치 | 파일 상단으로 이동 |
| OCR 픽스처 폰트 너무 작음 | 800x200 이미지 + `load_default(size=36)` |
| `unreadable_image_pdf_bytes` 2x2 불안정 | 1x1 흰색 픽셀로 변경 |
| `fitz.Page.get_textpage_ocr` 패치 불안정 | `_ocr_fallback` 직접 패치 + `_ocr_fallback` 직접 단위 테스트 추가 |
| `parsers/.ai.md` 구조 섹션 부정확 | 실제 파일 구조로 수정 |

### 라운드 3 — git pull origin main 후 최종 (3개 병렬)

| 검증 유형 | 결과 | 발견 이슈 |
|-----------|------|-----------|
| 아키텍처 | **PASS** | 없음 |
| 백엔드 | **PASS** | 없음 |
| 서비스 | **PASS** | 없음 |

### 라운드 3에서 수정한 항목

| 이슈 | 수정 내용 |
|------|-----------|
| `_ocr_fallback` docstring 전제 조건 미명시 | docstring에 전제 조건(doc 열린 상태, 이미지 포함 확인) 추가 |
| `image_only_pdf_bytes` 레거시 혼란 | `[레거시]` 주석 추가 — 이미지 없는 빈 PDF임을 명시 |
| `test_image_only_pdf_raises_image_only_error` 광범위 assertion | `(EmptyPDFError, ImageOnlyPDFError)` → `EmptyPDFError`만 (이미지 없는 빈 PDF이므로) |

### 라운드 4 — Tesseract 설치 후 전체 포괄 검증 (3개 병렬)

| 검증 유형 | 결과 | 발견 이슈 |
|-----------|------|-----------|
| 아키텍처 (#71·#90·#113·#118 정합성) | **PASS** | 없음 |
| 백엔드 (`pdf_parser.py` 전수·`feedback_service` #113 충돌 점검) | **PASS** | 없음 |
| 서비스 (테스트 15개 전수·`02_test.md` 정합성) | **PASS** | 없음 |

### 라운드 4에서 수정한 항목

| 이슈 | 수정 내용 |
|------|-----------|
| `tests/unit/parsers/.ai.md` 누락 | AGENTS.md 규칙 준수 — 신규 생성 |
| `02_test.md` AC3 테스트명 약칭 | `test_ocr_empty_result_raises` → `test_ocr_empty_result_raises_image_only_error` 전체명으로 수정 |

### 라운드 5 — 전체 포괄 검증 (3개 병렬)

| 검증 유형 | 결과 | 발견 이슈 |
|-----------|------|-----------|
| 아키텍처 | **PASS** | 없음 |
| 백엔드 | **PASS** | 없음 |
| 서비스 | **PASS** | MINOR 2건 |

### 라운드 5에서 수정한 항목

| 이슈 | 수정 내용 |
|------|-----------|
| `test_empty_pdf_no_images_raises_empty_pdf_error` 중복 | `test_empty_pdf_raises_empty_pdf_error`와 동일 입력·동일 assertion → 제거 (24→23개) |
| `engine/.ai.md` scores 범위 표현 불명확 | "0~100 초과" → "0 미만 또는 100 초과"로 수정 |

### 향후 이슈 작업 시 주의사항

| 이슈 | 주의 사항 |
|------|-----------|
| #113 | `feedback_service._build_prompt()`에서 `target_role=None` 시 `TypeError` 발생 — None 가드 필수 |
| #118 | `/questions` multipart→JSON 전환 시 기존 테스트 9개 전면 수정 필요 |

---

## CI 참고사항

- 로컬 환경(Tesseract 5.4.0 설치): 23/23 PASS 확인
- Docker 환경(Dockerfile에 Tesseract 포함): 동일하게 23/23 PASS 예상
- CI 전략: 방안 A (multi-stage Docker) 확정 — `engine-ci.yml`에서 `docker/build-push-action@v5`의 `target: test`로 test 스테이지 빌드 후 `docker run --rm mirai-engine-test` 실행. GHA 레이어 캐시(`type=gha`) 적용으로 반복 실행 시 빌드 시간 최소화.
- `shutil.which("tesseract")` 패턴으로 Tesseract 미설치 환경에서도 graceful skip 유지
