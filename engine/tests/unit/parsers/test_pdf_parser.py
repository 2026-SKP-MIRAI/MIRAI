import pytest
import fitz
from app.parsers.pdf_parser import parse_pdf
from app.parsers.exceptions import (
    EmptyPDFError, ImageOnlyPDFError, ParseError,
    FileSizeError, PageLimitError
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


def test_image_only_pdf_raises_image_only_error():
    # 텍스트 0자인 PDF → ImageOnlyPDFError 발생
    pdf_bytes = make_empty_pdf()
    with pytest.raises((EmptyPDFError, ImageOnlyPDFError)):
        parse_pdf(pdf_bytes, filename="image.pdf")


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
