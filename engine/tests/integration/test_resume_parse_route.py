import shutil
from unittest.mock import patch

import fitz
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app

HAS_TESSERACT = shutil.which("tesseract") is not None
requires_tesseract = pytest.mark.skipif(
    not HAS_TESSERACT, reason="Tesseract not installed"
)


def make_valid_pdf(pages: int = 1, text: str = "이력서 내용") -> bytes:
    doc = fitz.open()
    for _ in range(pages):
        page = doc.new_page()
        page.insert_text((50, 50), text)
    return doc.tobytes()


def make_empty_pdf() -> bytes:
    doc = fitz.open()
    doc.new_page()
    return doc.tobytes()


@pytest.mark.asyncio
async def test_parse_200_success():
    pdf_bytes = make_valid_pdf()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/resume/parse",
            files={"file": ("resume.pdf", pdf_bytes, "application/pdf")},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "resumeText" in data
    assert "extractedLength" in data
    assert data["extractedLength"] == len(data["resumeText"])
    assert len(data["resumeText"]) > 0


@requires_tesseract
@pytest.mark.asyncio
async def test_parse_200_ocr_pdf(ocr_target_pdf_bytes):
    """이미지 PDF → OCR → 200 (ParsedResume 인터페이스 불변, #71 연결)"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/resume/parse",
            files={"file": ("image_resume.pdf", ocr_target_pdf_bytes, "application/pdf")},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "resumeText" in data
    assert len(data["resumeText"]) > 0


@pytest.mark.asyncio
async def test_parse_400_no_file():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/resume/parse")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_parse_400_not_pdf():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/resume/parse",
            files={"file": ("resume.txt", b"hello world", "text/plain")},
        )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_parse_400_not_pdf_disguised():
    """filename=.pdf이지만 실제 content_type=text/plain (MIME 위장)"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/resume/parse",
            files={"file": ("resume.pdf", b"not a real pdf", "text/plain")},
        )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_parse_400_file_too_large():
    max_size = 5 * 1024 * 1024
    large_bytes = b"\x00" * (max_size + 1)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/resume/parse",
            files={"file": ("large.pdf", large_bytes, "application/pdf")},
        )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_parse_400_too_many_pages():
    pdf_bytes = make_valid_pdf(pages=11)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/resume/parse",
            files={"file": ("many.pdf", pdf_bytes, "application/pdf")},
        )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_parse_422_empty_pdf():
    pdf_bytes = make_empty_pdf()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/resume/parse",
            files={"file": ("empty.pdf", pdf_bytes, "application/pdf")},
        )
    assert resp.status_code == 422


@requires_tesseract
@pytest.mark.asyncio
async def test_parse_422_unreadable_image_pdf(unreadable_image_pdf_bytes):
    """OCR 판독 불가 이미지 PDF → 422 (#71 연결)"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/resume/parse",
            files={"file": ("noise.pdf", unreadable_image_pdf_bytes, "application/pdf")},
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_parse_400_corrupted_pdf():
    """손상된 PDF(fitz 파싱 실패) → ParseError → 400"""
    corrupted_bytes = b"%PDF-1.4 corrupted content \x00\x01\x02"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/resume/parse",
            files={"file": ("corrupted.pdf", corrupted_bytes, "application/pdf")},
        )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_parse_500_unexpected_parser_error():
    """parse_pdf가 예기치 않은 예외(비ParseError) 발생 → 500"""
    pdf_bytes = make_valid_pdf()
    with patch("app.routers.resume.parse_pdf", side_effect=RuntimeError("unexpected")):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post(
                "/api/resume/parse",
                files={"file": ("resume.pdf", pdf_bytes, "application/pdf")},
            )
    assert resp.status_code == 500
