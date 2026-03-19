import io
import pytest
from unittest.mock import MagicMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.parsers.exceptions import LLMError
from app.schemas import ParsedResume


SAMPLE_PARSED = ParsedResume(text="자소서 내용입니다.", extracted_length=10)


def make_pdf_file(filename: str = "resume.pdf"):
    return {"file": (filename, io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")}


@pytest.mark.asyncio
async def test_200_analyze_success():
    with patch("app.routers.resume.parse_pdf", return_value=SAMPLE_PARSED), \
         patch("app.routers.resume.extract_target_role", return_value="백엔드 개발자"):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/resume/analyze", files=make_pdf_file())
    assert resp.status_code == 200
    data = resp.json()
    assert data["resumeText"] == "자소서 내용입니다."
    assert data["extractedLength"] == 10
    assert data["targetRole"] == "백엔드 개발자"


@pytest.mark.asyncio
async def test_200_analyze_target_role_fallback():
    with patch("app.routers.resume.parse_pdf", return_value=SAMPLE_PARSED), \
         patch("app.routers.resume.extract_target_role", return_value="미지정"):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/resume/analyze", files=make_pdf_file())
    assert resp.status_code == 200
    assert resp.json()["targetRole"] == "미지정"


@pytest.mark.asyncio
async def test_400_no_file():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/resume/analyze")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_400_non_pdf():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/resume/analyze",
                             files={"file": ("resume.txt", io.BytesIO(b"text"), "text/plain")})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_500_llm_error():
    with patch("app.routers.resume.parse_pdf", return_value=SAMPLE_PARSED), \
         patch("app.routers.resume.extract_target_role", side_effect=LLMError("API 오류")):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/resume/analyze", files=make_pdf_file())
    assert resp.status_code == 500


@pytest.mark.asyncio
async def test_422_empty_pdf():
    from app.parsers.exceptions import EmptyPDFError
    with patch("app.routers.resume.parse_pdf", side_effect=EmptyPDFError("빈 PDF")):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/resume/analyze", files=make_pdf_file())
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_422_image_only_pdf():
    from app.parsers.exceptions import ImageOnlyPDFError
    with patch("app.routers.resume.parse_pdf", side_effect=ImageOnlyPDFError("이미지 전용 PDF")):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/resume/analyze", files=make_pdf_file())
    assert resp.status_code == 422
