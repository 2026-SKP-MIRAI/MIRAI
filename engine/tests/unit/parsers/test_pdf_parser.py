import io
import shutil
from unittest.mock import patch

import fitz
import pytest
from PIL import Image

from app.parsers.pdf_parser import parse_pdf, _ocr_fallback
from app.parsers.exceptions import (
    EmptyPDFError, ImageOnlyPDFError, ParseError,
    FileSizeError, PageLimitError
)

HAS_TESSERACT = shutil.which("tesseract") is not None
requires_tesseract = pytest.mark.skipif(
    not HAS_TESSERACT, reason="Tesseract not installed"
)


def make_pdf_with_text(text: str, pages: int = 1) -> bytes:
    doc = fitz.open()
    for _ in range(pages):
        page = doc.new_page()
        page.insert_text((50, 50), text)
    return doc.tobytes()


def make_empty_pdf(pages: int = 1) -> bytes:
    doc = fitz.open()
    for _ in range(pages):
        doc.new_page()
    return doc.tobytes()


def test_parse_pdf_success(minimal_pdf_bytes):
    result = parse_pdf(minimal_pdf_bytes, filename="resume.pdf")
    assert result.text
    assert result.extracted_length == len(result.text)


def test_empty_pdf_raises_empty_pdf_error():
    pdf_bytes = make_empty_pdf()
    with pytest.raises(EmptyPDFError):
        parse_pdf(pdf_bytes, filename="empty.pdf")


def test_corrupted_pdf_raises_parse_error():
    with pytest.raises(ParseError):
        parse_pdf(b"not a pdf at all", filename="corrupted.pdf")


def test_large_file_raises_file_size_error():
    max_size = 5 * 1024 * 1024
    large_bytes = b"fake" * (max_size + 1)
    with pytest.raises(FileSizeError):
        parse_pdf(large_bytes, filename="large.pdf", max_file_size_bytes=max_size)


def test_too_many_pages_raises_page_limit_error():
    pdf_bytes = make_pdf_with_text("내용", pages=11)
    with pytest.raises(PageLimitError):
        parse_pdf(pdf_bytes, filename="many.pdf", max_pages=10)


def test_exactly_5mb_passes():
    max_size = 5 * 1024 * 1024
    pdf_bytes = make_pdf_with_text("내용")
    result = parse_pdf(pdf_bytes, filename="ok.pdf", max_file_size_bytes=max_size)
    assert result is not None


def test_5mb_plus_1byte_fails():
    max_size = 5 * 1024 * 1024
    oversized = b'\x00' * (max_size + 1)
    with pytest.raises(FileSizeError):
        parse_pdf(oversized, filename="big.pdf", max_file_size_bytes=max_size)


def test_exactly_10_pages_passes():
    pdf_bytes = make_pdf_with_text("내용", pages=10)
    result = parse_pdf(pdf_bytes, filename="ok.pdf", max_pages=10)
    assert result is not None


def test_11_pages_fails():
    pdf_bytes = make_pdf_with_text("내용", pages=11)
    with pytest.raises(PageLimitError):
        parse_pdf(pdf_bytes, filename="big.pdf", max_pages=10)


# --- OCR fallback 테스트 ---


@requires_tesseract
def test_ocr_extracts_text_from_image_pdf(ocr_target_pdf_bytes):
    """AC1: 이미지 PDF → OCR → ParsedResume 반환"""
    result = parse_pdf(ocr_target_pdf_bytes, filename="image_resume.pdf")
    assert result.text
    assert any(word in result.text for word in ["Hello", "OCR", "Test", "Resume"])
    assert result.extracted_length == len(result.text)


@requires_tesseract
def test_ocr_empty_result_raises_image_only_error(unreadable_image_pdf_bytes):
    """AC3: OCR 결과가 빈 문자열이면 ImageOnlyPDFError"""
    with pytest.raises(ImageOnlyPDFError):
        parse_pdf(unreadable_image_pdf_bytes, filename="noise.pdf")


def test_ocr_not_run_when_text_exists():
    """AC2: 텍스트 레이어가 있으면 OCR 미실행"""
    # 텍스트 + 이미지 혼합 PDF 생성
    img = Image.new("RGB", (100, 100), "white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "text layer here")
    page.insert_image(fitz.Rect(50, 200, 150, 300), stream=buf.read())
    pdf_bytes = doc.tobytes()

    with patch("app.parsers.pdf_parser._ocr_fallback") as mock_ocr:
        result = parse_pdf(pdf_bytes, filename="mixed.pdf")
        mock_ocr.assert_not_called()
    assert "text layer here" in result.text


def test_ocr_internal_error_raises_image_only_error(ocr_target_pdf_bytes):
    """AC3: OCR 내부 에러(Tesseract 미설치 등) 시 ImageOnlyPDFError"""
    with patch(
        "app.parsers.pdf_parser._ocr_fallback",
        return_value="",
    ):
        with pytest.raises(ImageOnlyPDFError):
            parse_pdf(ocr_target_pdf_bytes, filename="error.pdf")


def test_ocr_fallback_returns_empty_on_exception():
    """_ocr_fallback 내부에서 예외 발생 시 빈 문자열 반환 확인"""
    doc = fitz.open()
    page = doc.new_page()
    # 이미지 삽입 (OCR 시도 대상)
    img = Image.new("RGB", (10, 10), "white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    page.insert_image(fitz.Rect(50, 50, 60, 60), stream=buf.read())

    with patch("fitz.Page.get_textpage_ocr", side_effect=RuntimeError("OCR init failed")):
        result = _ocr_fallback(doc)
    assert result == ""
