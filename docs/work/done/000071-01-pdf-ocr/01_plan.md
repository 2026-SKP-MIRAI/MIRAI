# [#71] feat: [기능 01 고도화] PDF 파서 OCR — 이미지 PDF에서 텍스트 추출 — 구현 계획

> 작성: 2026-03-16 | 검증: 2회 (아키텍처·테스트·API 시그니처·Docker·CI 전략)

---

## 완료 기준

- [ ] 이미지만 포함된 PDF 업로드 시 OCR을 통해 텍스트 추출 성공 및 정상 응답 반환
- [ ] 기존 텍스트 레이어 PDF의 파싱 동작·성능에 영향 없음
- [ ] OCR 실패(판독 불가·빈 결과) 시 기존 `ImageOnlyPDFError(422)` 예외 계층 준수
- [ ] 이미지 PDF 샘플 픽스처를 `engine/tests/fixtures/`에 추가하고 TDD로 구현
- [ ] `ParsedResume` 응답 스키마 변경 없음 (인터페이스 불변)

---

## 1. OCR 라이브러리 선택

| 기준 | pytesseract + Tesseract | PyMuPDF 내장 OCR | Vision API |
|---|---|---|---|
| 정확도 | 높음 (Tesseract 5.x) | 동일 (내부적으로 Tesseract) | 최고 |
| 속도 | ~1-3초/페이지 | 동일 | 느림 (네트워크) |
| 비용 | 무료 | 무료 | 호출당 과금 |
| Docker 크기 영향 | +~200MB | +~200MB | 0 |
| 한국어 지원 | tessdata-kor 필요 | tessdata-kor 필요 | 기본 지원 |
| 의존성 복잡도 | pip(pytesseract+Pillow) + apt(tesseract) | **추가 pip 없음**, apt(tesseract)만 | **불변식 위반** |
| 기존 코드 통합 | fitz→이미지추출→PIL→pytesseract | `page.get_textpage_ocr()` 한 줄 | parsers/에서 API 호출 불가 |

### 결정: PyMuPDF 내장 OCR

- **Vision API 탈락**: `engine/.ai.md` 불변식 1번 — "LLM API 호출은 engine/services/에서만". parsers/에서 외부 API 호출 시 위반.
- **pytesseract 탈락**: Pillow + pytesseract 프로덕션 의존성 추가 필요. fitz가 이미 있는데 중간 단계(이미지 추출→PIL 변환)가 불필요한 복잡도.
- **PyMuPDF 내장 채택**: `page.get_textpage_ocr()`로 한 줄 호출. 프로덕션 Python 의존성 추가 없음. Tesseract 시스템 패키지만 Dockerfile에 설치.

> **검증 완료**: `pymupdf[ocr]` extra는 존재하지 않음. OCR 기능은 PyMuPDF에 내장되어 있으며 시스템 Tesseract 설치만 필요. `pyproject.toml`의 `pymupdf>=1.24.0`은 그대로 유지.

### PyMuPDF OCR API 정확한 시그니처 (v1.27.1 실측)

```python
page.get_textpage_ocr(
    flags: int = 0,          # 텍스트 추출 플래그 (기본 0)
    language: str = "eng",   # Tesseract 언어 코드 ("eng+kor" 형식)
    dpi: int = 72,           # 렌더링 해상도 (높을수록 정확, 느림)
    full: bool = False,      # True=전체 페이지 OCR, False=텍스트 없는 영역만
    tessdata: str = None,    # tessdata 폴더 경로 (None=자동)
) -> TextPage
```

Tesseract 미설치 시 에러: `fitz.mupdf.FzErrorLibrary: code=3: OCR initialisation failed`
→ `except Exception`으로 포착 가능.

### DPI 성능 트레이드오프

| DPI | 페이지당 메모리 | 상대값 | 렌더링 시간 |
|---|---|---|---|
| 72 (기본) | ~1.4 MB | 1x | ~0.8 ms |
| 150 (권장) | ~6 MB | 4.3x | ~1 ms |
| 300 (고정밀) | ~24 MB | 17.4x | ~6.5 ms |

구현 시 `dpi=300`으로 시작하여 정확도 베이스라인을 확보한 뒤, 프로덕션 배포 시 성능 모니터링 결과에 따라 조정 가능. 10페이지 PDF 기준 dpi=300일 때 최대 ~240MB 메모리 사용.

---

## 2. 건드릴 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `engine/app/parsers/pdf_parser.py` | `ImageOnlyPDFError` 분기에 OCR fallback 삽입 (`_ocr_fallback` 헬퍼) |
| `engine/Dockerfile` | `pip install` 전에 `tesseract-ocr` + `tesseract-ocr-kor` apt 설치 레이어 추가 |
| `engine/pyproject.toml` | dev 의존성에 `Pillow>=10.0.0` 추가 (테스트 픽스처 이미지 생성용) |
| `engine/tests/conftest.py` | `ocr_target_pdf_bytes`, `unreadable_image_pdf_bytes` 픽스처 추가 |
| `engine/tests/unit/parsers/test_pdf_parser.py` | OCR 성공·실패·미실행·에러 테스트 4개 추가 |
| `engine/tests/integration/test_resume_questions_route.py` | OCR PDF 업로드 성공 통합 테스트 1개 추가 |
| `engine/app/parsers/.ai.md` | OCR fallback 동작 문서화 |
| `engine/tests/.ai.md` | OCR 픽스처 설명 추가 |
| `engine/.ai.md` | 파서 동작 계약에 OCR 행 추가 |

**건드리지 않는 파일:**

| 파일 | 이유 |
|---|---|
| `engine/app/parsers/exceptions.py` | 이슈 AC3 "기존 예외 계층 준수" — 새 예외 추가 안 함 |
| `engine/app/schemas.py` | 이슈 AC5 "ParsedResume 변경 없음" |
| `engine/app/main.py` | `ImageOnlyPDFError`가 이미 422 핸들러에 등록됨 (Line 21). 변경 불필요 |
| `engine/pyproject.toml` (프로덕션) | `pymupdf>=1.24.0` 그대로 유지. `[ocr]` extra 불존재 확인 완료 |

---

## 3. 예외 처리 설계

```
PDF 입력
  → 텍스트 추출 (page.get_text())
  → 텍스트 있음? ─ YES ─→ ParsedResume 반환 (기존 흐름, 변경 없음)
  → 텍스트 없음?
      → 이미지 있음?
          → YES → OCR fallback 시도 (_ocr_fallback)
              → OCR 텍스트 있음? ─→ ParsedResume 반환 (신규)
              → OCR 텍스트 빈 문자열? ─→ ImageOnlyPDFError(422) (기존 동일)
              → OCR 내부 에러 (FzErrorLibrary 등)? ─→ ImageOnlyPDFError(422) (에러 래핑)
          → NO → EmptyPDFError(422) (기존 동일)
```

**설계 원칙:**
- **새 예외 클래스 없음**: 이슈 AC3 "기존 `ImageOnlyPDFError(422)` 예외 계층 준수"에 따라, OCR 실패·에러 모두 `ImageOnlyPDFError`로 래핑. 디버깅 정보는 `from e` 체이닝으로 보존.
- **텍스트 PDF 흐름 무변경**: OCR은 `not full_text and has_images` 분기에서만 실행. 텍스트 레이어가 있으면 기존과 완전히 동일한 경로.
- **main.py 변경 불필요**: `ImageOnlyPDFError`는 이미 `main.py` Line 21에서 `@app.exception_handler(ImageOnlyPDFError)`로 422에 매핑됨.

---

## 4. 테스트 전략

### 4.1 합성 이미지 PDF 픽스처

실제 PDF 파일 커밋 금지 규칙(`engine/tests/.ai.md`, `.gitignore`에 `*.pdf` 패턴 확인 완료) 준수를 위해 **런타임 합성**:

```python
# conftest.py — ocr_target_pdf_bytes (신규)
from PIL import Image, ImageDraw
import io, fitz

@pytest.fixture
def ocr_target_pdf_bytes() -> bytes:
    """OCR로 읽을 수 있는 텍스트 이미지가 포함된 PDF"""
    img = Image.new("RGB", (400, 100), "white")
    draw = ImageDraw.Draw(img)
    draw.text((10, 30), "Hello OCR Test Resume", fill="black")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    doc = fitz.open()
    page = doc.new_page()
    page.insert_image(fitz.Rect(50, 50, 450, 150), stream=buf.read())
    return doc.tobytes()

@pytest.fixture
def unreadable_image_pdf_bytes() -> bytes:
    """OCR로 판독 불가능한 노이즈 이미지 PDF"""
    img = Image.new("RGB", (2, 2), "gray")  # 너무 작아서 텍스트 인식 불가
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    doc = fitz.open()
    page = doc.new_page()
    page.insert_image(fitz.Rect(50, 50, 52, 52), stream=buf.read())
    return doc.tobytes()
```

- **영문 텍스트 사용**: Tesseract 기본 설치에 영어 traineddata 포함 → CI에서 한국어 traineddata 없이도 테스트 통과
- **Pillow**: PyMuPDF 간접 의존으로 이미 설치되어 있지만, 테스트 픽스처 목적을 명시하기 위해 dev 의존성에 추가

> **주의 1**: 기존 `image_only_pdf_bytes` 픽스처는 실제 이미지를 포함하지 않음 (`doc.new_page()` 만 호출). `has_images=False`가 되어 OCR 분기에 진입하지 않음. 또한 이 픽스처는 **정의만 되어 있고 어느 테스트도 사용하지 않음** (`test_image_only_pdf_raises`는 `make_empty_pdf()`를 사용). 이 픽스처는 수정하지 않고 새 픽스처(`ocr_target_pdf_bytes`)를 추가한다.

> **주의 2 — CI 환경**: OCR 테스트는 Tesseract 시스템 패키지가 필요. CI(GitHub Actions)에서 Tesseract가 없으면 `_ocr_fallback`이 빈 문자열을 반환하여 `test_ocr_extracts_text_from_image_pdf`가 실패함. 대응 방안:
> - **방안 A (권장)**: CI에서 Docker 기반 테스트 (`docker run` 으로 테스트 실행, Dockerfile에 Tesseract 포함)
> - **방안 B**: GitHub Actions step에서 `apt-get install tesseract-ocr` 추가
> - **방안 C**: `@pytest.mark.skipif(not HAS_TESSERACT)` 마커로 OCR 테스트 조건부 스킵

### 4.2 기존 테스트 회귀 분석

| 기존 테스트 | 회귀 여부 | 이유 |
|---|---|---|
| `test_image_only_pdf_raises_image_only_error` | **없음** | `make_empty_pdf()` 사용 → 이미지 없음 → `has_images=False` → EmptyPDFError 경로 (OCR 미진입) |
| `test_empty_pdf_raises_empty_pdf_error` | **없음** | 동일 이유 |
| `test_422_empty_pdf` (통합) | **없음** | `make_empty_pdf()` 사용 → 이미지 없음 → EmptyPDFError → 422 (기존 동일) |
| 나머지 8개 단위 + 7개 통합 | **없음** | 텍스트 레이어 존재 또는 파일 검증 단계에서 처리 |

### 4.3 새 테스트 케이스

**단위 테스트** (`test_pdf_parser.py` — 4개 추가):

| # | 테스트 | 입력 | 기대 결과 | AC |
|---|---|---|---|---|
| 1 | `test_ocr_extracts_text_from_image_pdf` | `ocr_target_pdf_bytes` | ParsedResume 반환, text에 "Hello" 또는 "OCR" 포함 | AC1 |
| 2 | `test_ocr_empty_result_raises_image_only_error` | `unreadable_image_pdf_bytes` (2x2 노이즈 이미지) | ImageOnlyPDFError | AC3 |
| 3 | `test_ocr_not_run_when_text_exists` | 텍스트+이미지 혼합 PDF (런타임 합성) | ParsedResume 반환 (텍스트 레이어에서), mock으로 OCR 미호출 확인 | AC2 |
| 4 | `test_ocr_internal_error_raises_image_only_error` | `patch("fitz.Page.get_textpage_ocr", side_effect=RuntimeError)` | ImageOnlyPDFError | AC3 |

**통합 테스트** (`test_resume_questions_route.py` — 1개 추가):

| # | 테스트 | 입력 | 기대 결과 | AC |
|---|---|---|---|---|
| 1 | `test_200_ocr_pdf_success` | 이미지 PDF 업로드 (LLM mock) | 200 + questions 포함 | AC1, AC5 |

**AC↔테스트 매핑:**

| AC | 커버하는 테스트 |
|---|---|
| AC1: 이미지 PDF OCR 성공 | `test_ocr_extracts_text_from_image_pdf`, `test_200_ocr_pdf_success` |
| AC2: 기존 텍스트 PDF 무영향 | `test_ocr_not_run_when_text_exists` + 기존 10개 단위 테스트 |
| AC3: OCR 실패 시 ImageOnlyPDFError | `test_ocr_empty_result_raises`, `test_ocr_internal_error_raises` |
| AC4: 픽스처 + TDD | `conftest.py` 합성 픽스처 + TDD 순서 |
| AC5: ParsedResume 불변 | `test_200_ocr_pdf_success` (응답 스키마 검증) + schemas.py 미수정 |

---

## 5. 단계별 구현 순서 (Red → Green → Refactor)

### Step 1: 의존성 준비
- `engine/pyproject.toml` — dev에 `Pillow>=10.0.0` 추가
- `engine/Dockerfile` — `pip install` **전에** Tesseract 설치 레이어 추가 (Docker 캐시 효율 최적):
  ```dockerfile
  FROM python:3.12-slim

  ENV PYTHONUNBUFFERED=1
  WORKDIR /app

  # Tesseract OCR 시스템 패키지 (캐시 계층 분리)
  RUN apt-get update && \
      apt-get install -y --no-install-recommends \
      tesseract-ocr tesseract-ocr-kor && \
      rm -rf /var/lib/apt/lists/*

  COPY pyproject.toml .
  RUN pip install --no-cache-dir .

  COPY app/ app/

  RUN useradd -m appuser
  USER appuser
  CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
  ```

### Step 2: Red — 픽스처 + 실패 테스트 작성
- `engine/tests/conftest.py` — `ocr_target_pdf_bytes`, `unreadable_image_pdf_bytes` 픽스처 추가
- `engine/tests/unit/parsers/test_pdf_parser.py` — OCR 테스트 4개 작성
- `pytest tests/unit/parsers/` 실행 → 새 테스트 FAIL 확인 (Red)

### Step 3: Green — OCR fallback 구현
- `engine/app/parsers/pdf_parser.py` 수정:

  **`_ocr_fallback` 헬퍼 함수 추가** (모듈 레벨, `parse_pdf` 위 또는 아래):
  ```python
  def _ocr_fallback(doc: fitz.Document) -> str:
      """이미지 PDF에서 OCR로 텍스트 추출. 실패 시 빈 문자열 반환."""
      try:
          parts = []
          for page in doc:
              tp = page.get_textpage_ocr(language="eng+kor", dpi=300)
              parts.append(page.get_text(textpage=tp))
          return "\n".join(parts).strip()
      except Exception:
          return ""
  ```

  **기존 `has_images` 분기 교체** (Line 42-45):
  ```python
  if has_images:
      ocr_text = _ocr_fallback(doc)
      if ocr_text:
          return ParsedResume(text=ocr_text, extracted_length=len(ocr_text))
      raise ImageOnlyPDFError(
          "이미지만 포함된 PDF입니다. 텍스트가 포함된 PDF를 업로드해 주세요."
      )
  ```

- `pytest tests/unit/parsers/` 실행 → 전체 PASS (Green)

### Step 4: Refactor
- 코드 정리 (필요 시)
- 기존 전체 테스트 실행: `pytest tests/ -v` → 회귀 없음 확인

### Step 5: 통합 테스트 추가
- `engine/tests/integration/test_resume_questions_route.py` — `test_200_ocr_pdf_success` 추가
- `pytest tests/integration/` → PASS 확인

### Step 6: .ai.md 최신화 (아래 섹션 6 참조)

---

## 6. .ai.md 최신화 목록

| 파일 | 업데이트 내용 |
|---|---|
| `engine/.ai.md` | 파서 동작 계약 테이블에 "이미지 PDF + OCR 성공 → ParsedResume", "이미지 PDF + OCR 실패 → ImageOnlyPDFError(422)" 행 추가 |
| `engine/app/parsers/.ai.md` | 역할에 "OCR fallback: 텍스트 레이어 없는 이미지 PDF에서 PyMuPDF 내장 Tesseract OCR로 텍스트 추출" 추가. 의존성에 Tesseract 시스템 패키지 명시 |
| `engine/tests/.ai.md` | 구조에 OCR 테스트 케이스 설명 추가. 픽스처에 "Pillow+fitz로 합성한 이미지 PDF (`ocr_target_pdf_bytes`, `unreadable_image_pdf_bytes`)" 추가 |

---

## 검증 체크리스트

### 아키텍처 불변식 준수
- [x] PDF 파싱은 `engine/app/parsers/`에서만 — OCR도 `pdf_parser.py` 내 `_ocr_fallback()`에서 실행
- [x] LLM 호출 없음 — OCR은 로컬 Tesseract (Vision API 탈락 사유: 불변식 1번 위반)
- [x] `ParsedResume` 스키마 변경 없음 — `schemas.py` 미수정

### 이슈 #71 완료 기준 커버
- [x] AC1: 이미지 PDF → OCR → ParsedResume 반환 (Step 3 `_ocr_fallback`)
- [x] AC2: 텍스트 PDF 흐름 무변경 — OCR은 `not full_text and has_images` 분기에서만 (Step 3 + `test_ocr_not_run_when_text_exists`로 검증)
- [x] AC3: OCR 빈 결과/에러 → ImageOnlyPDFError(422) 유지 (Step 3, 새 예외 없음)
- [x] AC4: 합성 이미지 PDF 픽스처 + TDD (Step 1-2, `conftest.py` 런타임 합성)
- [x] AC5: ParsedResume 변경 없음 — `schemas.py` 미수정

### main.py 수정 불필요 확인
- [x] `ImageOnlyPDFError`는 `main.py` Line 21 `@app.exception_handler(ImageOnlyPDFError)` → 422 이미 등록

### 기존 테스트 회귀 없음
- [x] 기존 단위 10개: 모두 이미지 없는 PDF 사용 → OCR 미진입
- [x] 기존 통합 8개 (`test_resume_questions_route.py`): `make_empty_pdf()` = 이미지 없음 → OCR 미진입
- [x] `conftest.py`의 `image_only_pdf_bytes`: 실제 이미지 없음, 어느 테스트도 미사용 → 수정하지 않음

### 규칙 준수
- [x] `fixtures/input/` 실제 PDF 커밋 금지 — 모든 픽스처는 Pillow+fitz로 런타임 합성
- [x] `.gitignore`에 `*.pdf` 패턴 존재 확인 완료
- [x] `pyproject.toml` 프로덕션 의존성 변경 없음 — `pymupdf>=1.24.0` 유지, `[ocr]` extra 불존재 확인

### Docker 이미지 영향
- [x] Tesseract + 한국어 데이터로 ~200MB 증가 (불가피, `--no-install-recommends`로 최소화)
- [x] Tesseract 설치 레이어를 `pip install` 전에 배치 → Docker 캐시 효율 최적
- [x] `.dockerignore`에 `tests/` 제외 확인 → Docker 이미지에 테스트 미포함

---

## 7. 실제 PDF 테스트 결과 (2026-03-17)

### 테스트 파일
| 파일 | 유형 | 텍스트 레이어 | OCR 추출 길이 | 결과 |
|------|------|------|------|------|
| 포트폴리오_003_반도체소프트웨어.pdf | 이미지 PDF (텍스트 레이어 없음) | 0자 | 3,579자 | OCR 경로, 한글 정상 인식 |
| 포트폴리오_004_아트디렉터.pdf | 이미지 PDF (텍스트 레이어 없음) | 0자 | 6,518자 | OCR 경로, 한글 정상 인식 |

### `kor.traineddata` 설치
- Docker: `tesseract-ocr-kor` apt 패키지로 자동 포함 (`apt-get install tesseract-ocr tesseract-ocr-kor`)
- 로컬 Windows: `C:\Program Files\Tesseract-OCR\tessdata\kor.traineddata` 수동 설치 완료

### 향후 미해결 이슈
**비표준 인코딩 텍스트 레이어 → LLM 깨진 텍스트 전달 (미검증)**
- 텍스트 레이어가 있으나 비표준 인코딩으로 임베딩된 PDF는 `page.get_text()`가 깨진 텍스트 반환 가능
- 코드는 텍스트가 있다고 판단 → OCR 미진입 → 깨진 텍스트가 LLM에 전달되는 시나리오
- 해결 방안: 텍스트 추출 후 유효 유니코드 비율 체크 → 기준치 미만 시 OCR fallback 재시도
- **향후 이슈로 관리** — 실제 발생 사례 확인 후 진행
