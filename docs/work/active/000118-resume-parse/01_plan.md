# [#118] feat: [engine] 기능 01 고도화 — /api/resume/parse 신규 엔드포인트 + /questions JSON 수신 전환 — 구현 계획

> 작성: 2026-03-17 / 업데이트: 2026-03-18

---

## 완료 기준

- [x] `POST /api/resume/parse` — PDF 파일(multipart) 수신 시 `{ resumeText, extractedLength }` 200 반환
- [x] `/parse` 에러: 파일 없음/비PDF → 400, 빈PDF/이미지PDF → 422, 파싱 실패 → 500
- [x] `POST /api/resume/questions` — `{ resumeText }` JSON body 수신으로 변경 (multipart 제거)
- [x] `/questions` 에러: `resumeText` 누락/빈값 → 400, LLM 오류 → 500
- [x] `engine/.ai.md` API 계약에 `/api/resume/parse` 추가, `/questions` 입력 스펙 변경 반영
- [x] `routers/.ai.md`, `schemas` 관련 `.ai.md` 최신화
- [x] 단위 테스트 6개 이상 (14개) + 통합 테스트 4개 이상 (14개)

---

## 구현 계획

### 선행: #71 OCR main 머지

이 브랜치에는 #71(이미지 PDF OCR) 코드가 없었음. `git merge main` (fast-forward) 으로 반영.
- `pdf_parser.py`에 `_ocr_fallback()` 추가 — 이미지 PDF + OCR 성공 시 200 반환
- `/parse` 에러의 "이미지PDF → 422"는 "OCR 성공 시 200, 실패 시 422"로 정확히 이해해야 함

### Step 1: 스키마 추가 (`engine/app/schemas.py`) ✅

```python
class ParseResponse(BaseModel):
    resumeText: str
    extractedLength: int

class QuestionsRequest(BaseModel):
    resumeText: str = Field(..., min_length=1, max_length=50_000)
```

- `ParsedResume`(내부, snake_case)는 그대로 유지 — `ParseResponse`(HTTP 응답, camelCase)와 별개
- `max_length=50_000`: 5MB PDF ≈ 최대 ~16K 자 기준, 여유 있게 설정

### Step 2: 라우터 수정 (`engine/app/routers/resume.py`) ✅

**`/parse` 신규 (기존 `/questions`의 파일 수신 로직 이동):**
- Content-Length DoS 방어 + MIME 검증 + `parse_pdf()` 호출
- `return ParseResponse(resumeText=parsed.text, extractedLength=parsed.extracted_length)`

**`/questions` JSON 전환:**
- `body: QuestionsRequest` → `body.resumeText` 직접 사용
- `meta.extractedLength = len(body.resumeText)`

### Step 3: 테스트 작성

**`engine/tests/integration/test_resume_parse_route.py` (신규, 9개):**

| # | 테스트명 | 기대 |
|---|---------|------|
| 1 | `test_parse_200_success` | 200, resumeText + extractedLength |
| 2 | `test_parse_200_ocr_pdf` | 200, OCR 텍스트 (`@requires_tesseract`) |
| 3 | `test_parse_400_no_file` | 400 |
| 4 | `test_parse_400_not_pdf` | 400 |
| 5 | `test_parse_400_not_pdf_disguised` | 400 |
| 6 | `test_parse_400_file_too_large` | 400 |
| 7 | `test_parse_400_too_many_pages` | 400 |
| 8 | `test_parse_422_empty_pdf` | 422 |
| 9 | `test_parse_422_unreadable_image_pdf` | 422 (`@requires_tesseract`) |

**`engine/tests/integration/test_resume_questions_route.py` (전면 교체, 5개):**

| # | 테스트명 | 기대 |
|---|---------|------|
| 1 | `test_200_success` | 200, questions + meta |
| 2 | `test_200_meta_extracted_length` | meta.extractedLength == len(resumeText) |
| 3 | `test_400_missing_resume_text` | 400 |
| 4 | `test_400_empty_resume_text` | 400 |
| 5 | `test_500_llm_error` | 500 |

### Step 4: `.ai.md` 문서 최신화

- `engine/.ai.md`: `/parse` 계약 추가, `/questions` 계약 수정
- `engine/app/routers/.ai.md`: resume.py 설명에 `/parse` 추가

### 에러 매핑

| 시나리오 | 예외 | HTTP |
|---------|------|------|
| 파일 없음 / 비 PDF | `ParseError` | 400 |
| 크기 >5MB | `FileSizeError` | 400 |
| 페이지 >10 | `PageLimitError` | 400 |
| 빈 PDF | `EmptyPDFError` | 422 |
| 이미지 PDF + OCR 성공 | — | 200 |
| 이미지 PDF + OCR 실패 | `ImageOnlyPDFError` | 422 |
| resumeText 누락/빈값 | `RequestValidationError` | 400 |
| LLM 오류 | `LLMError` | 500 |

### 서비스 영향 (이 PR 범위 밖)

4개 서비스(siw, kwan, seung, lww)가 `/questions`에 FormData 전송 중.
모두 로컬에서 `pdf-parse`로 `resumeText` 보유 → 별도 PR에서 JSON 전환 예정.

---

## 작업 내역

- 2026-03-18: `git merge main` (fast-forward, #71 OCR 포함)
- 2026-03-18: `schemas.py` — `ParseResponse`, `QuestionsRequest` 추가
- 2026-03-18: `routers/resume.py` — `/parse` 신규, `/questions` JSON 전환
- 2026-03-18: `tests/integration/test_resume_parse_route.py` 신규 (9개 테스트)
- 2026-03-18: `tests/integration/test_resume_questions_route.py` JSON body 교체 (5개 테스트)
- 2026-03-18: `engine/.ai.md` — `/parse` 계약 추가, `/questions` 계약 수정
- 2026-03-18: `engine/app/routers/.ai.md` — resume.py 설명 최신화
