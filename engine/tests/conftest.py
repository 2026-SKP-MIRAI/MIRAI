import pytest
from pathlib import Path
import fitz  # PyMuPDF

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
    """텍스트 없는 PDF (이미지 전용 시뮬레이션)"""
    doc = fitz.open()
    doc.new_page()  # 실제로는 텍스트 추출 시 0자
    return doc.tobytes()

# 외부 fixture (gitignored)
@pytest.fixture
def sample_pdf_bytes():
    p = FIXTURES_INPUT / "sample_resume.pdf"
    if not p.exists():
        pytest.skip("external fixture not found")
    return p.read_bytes()
