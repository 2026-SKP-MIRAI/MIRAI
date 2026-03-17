import shutil

import pytest
import fitz
from unittest.mock import MagicMock, patch
from httpx import AsyncClient, ASGITransport

from app.main import app

HAS_TESSERACT = shutil.which("tesseract") is not None
requires_tesseract = pytest.mark.skipif(
    not HAS_TESSERACT, reason="Tesseract not installed"
)

VALID_LLM_RESPONSE = '[' + ','.join([
    f'{{"category":"직무 역량","question":"질문{i}?"}}'
    for i in range(8)
]) + ']'

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

def mock_llm_success():
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=VALID_LLM_RESPONSE))
    ]
    return fake

@pytest.mark.asyncio
async def test_200_success():
    pdf_bytes = make_valid_pdf()
    with patch("app.services.llm_service.OpenAI", return_value=mock_llm_success()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post(
                "/api/resume/questions",
                files={"file": ("resume.pdf", pdf_bytes, "application/pdf")},
            )
    assert resp.status_code == 200
    data = resp.json()
    assert "questions" in data
    assert "meta" in data
    assert len(data["questions"]) >= 8

@pytest.mark.asyncio
async def test_400_no_file():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/resume/questions")
    assert resp.status_code == 400

@pytest.mark.asyncio
async def test_400_not_pdf():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/resume/questions",
            files={"file": ("resume.txt", b"hello world", "text/plain")},
        )
    assert resp.status_code == 400

@pytest.mark.asyncio
async def test_400_not_pdf_disguised():
    """filename=.pdf이지만 실제 content_type=text/plain"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/resume/questions",
            files={"file": ("resume.pdf", b"not a real pdf", "text/plain")},
        )
    assert resp.status_code == 400

@pytest.mark.asyncio
async def test_400_file_too_large():
    max_size = 5 * 1024 * 1024
    large_bytes = b'\x00' * (max_size + 1)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/resume/questions",
            files={"file": ("large.pdf", large_bytes, "application/pdf")},
        )
    assert resp.status_code == 400

@pytest.mark.asyncio
async def test_400_too_many_pages():
    pdf_bytes = make_valid_pdf(pages=11)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/resume/questions",
            files={"file": ("many.pdf", pdf_bytes, "application/pdf")},
        )
    assert resp.status_code == 400

@pytest.mark.asyncio
async def test_422_empty_pdf():
    pdf_bytes = make_empty_pdf()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/resume/questions",
            files={"file": ("empty.pdf", pdf_bytes, "application/pdf")},
        )
    assert resp.status_code == 422

@pytest.mark.asyncio
async def test_500_llm_error():
    pdf_bytes = make_valid_pdf()
    fake = MagicMock()
    fake.chat.completions.create.side_effect = Exception("API 오류")
    with patch("app.services.llm_service.OpenAI", return_value=fake):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post(
                "/api/resume/questions",
                files={"file": ("resume.pdf", pdf_bytes, "application/pdf")},
            )
    assert resp.status_code == 500


@requires_tesseract
@pytest.mark.asyncio
async def test_200_ocr_pdf_success(ocr_target_pdf_bytes):
    """AC1+AC5: 이미지 PDF → OCR → 200 + questions 응답 (ParsedResume 스키마 불변)"""
    with patch("app.services.llm_service.OpenAI", return_value=mock_llm_success()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post(
                "/api/resume/questions",
                files={"file": ("image_resume.pdf", ocr_target_pdf_bytes, "application/pdf")},
            )
    assert resp.status_code == 200
    data = resp.json()
    assert "questions" in data
    assert "meta" in data
    assert len(data["questions"]) >= 8
