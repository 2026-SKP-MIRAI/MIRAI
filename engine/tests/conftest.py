import io
import os
import sys
from pathlib import Path

import fitz  # PyMuPDF
import pytest

# Windows: Tesseract가 PATH에 없을 경우 자동 추가
_TESSERACT_WIN = Path("C:/Program Files/Tesseract-OCR")
if sys.platform == "win32" and _TESSERACT_WIN.exists():
    os.environ["PATH"] = str(_TESSERACT_WIN) + os.pathsep + os.environ.get("PATH", "")

FIXTURES_INPUT = Path(__file__).parent / "fixtures/input"

# synthetic PDF fixture — 항상 존재 (gitignore 불필요)
@pytest.fixture
def minimal_pdf_bytes() -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "테스트 이력서 내용입니다.")
    return doc.tobytes()

@pytest.fixture
def empty_pdf_bytes() -> bytes:
    doc = fitz.open()
    doc.new_page()  # 텍스트 없음
    return doc.tobytes()

@pytest.fixture
def image_only_pdf_bytes() -> bytes:
    """텍스트 없는 빈 PDF.

    [레거시] 이름과 달리 실제 이미지를 포함하지 않음 — `doc.new_page()`만 호출.
    OCR 분기(has_images=True)에 진입하지 않으므로 EmptyPDFError가 발생.
    이미지 포함 PDF 테스트는 `ocr_target_pdf_bytes` 픽스처를 사용할 것.
    """
    doc = fitz.open()
    doc.new_page()  # 텍스트 없음, 이미지 없음
    return doc.tobytes()

# OCR 테스트용 합성 이미지 PDF 픽스처
@pytest.fixture
def ocr_target_pdf_bytes() -> bytes:
    """OCR로 읽을 수 있는 텍스트 이미지가 포함된 PDF"""
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGB", (800, 200), "white")
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default(size=36)
    draw.text((20, 60), "Hello OCR Test Resume", fill="black", font=font)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    doc = fitz.open()
    page = doc.new_page()
    page.insert_image(fitz.Rect(50, 50, 550, 250), stream=buf.read())
    return doc.tobytes()

@pytest.fixture
def unreadable_image_pdf_bytes() -> bytes:
    """OCR로 판독 불가능한 노이즈 이미지 PDF (1x1 흰색 픽셀)"""
    from PIL import Image

    img = Image.new("RGB", (1, 1), "white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    doc = fitz.open()
    page = doc.new_page()
    page.insert_image(fitz.Rect(50, 50, 51, 51), stream=buf.read())
    return doc.tobytes()

# 외부 fixture (gitignored)
@pytest.fixture
def sample_pdf_bytes():
    p = FIXTURES_INPUT / "sample_resume.pdf"
    if not p.exists():
        pytest.skip("external fixture not found")
    return p.read_bytes()
