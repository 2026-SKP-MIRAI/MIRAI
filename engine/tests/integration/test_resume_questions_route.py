import pytest
from unittest.mock import MagicMock, patch
from httpx import AsyncClient, ASGITransport

from app.main import app

VALID_LLM_RESPONSE = "[" + ",".join([
    f'{{"category":"직무 역량","question":"질문{i}?"}}'
    for i in range(8)
]) + "]"

SAMPLE_RESUME_TEXT = "저는 5년간 백엔드 개발을 담당했으며 Python과 FastAPI를 주로 사용했습니다."


def mock_llm_success():
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=VALID_LLM_RESPONSE))
    ]
    return fake


@pytest.mark.asyncio
async def test_200_success():
    with patch("app.services.llm_service.OpenAI", return_value=mock_llm_success()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post(
                "/api/resume/questions",
                json={"resumeText": SAMPLE_RESUME_TEXT},
            )
    assert resp.status_code == 200
    data = resp.json()
    assert "questions" in data
    assert "meta" in data
    assert len(data["questions"]) >= 8


@pytest.mark.asyncio
async def test_200_meta_extracted_length():
    """meta.extractedLength는 전달된 resumeText 길이와 같아야 한다"""
    with patch("app.services.llm_service.OpenAI", return_value=mock_llm_success()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post(
                "/api/resume/questions",
                json={"resumeText": SAMPLE_RESUME_TEXT},
            )
    assert resp.status_code == 200
    data = resp.json()
    assert data["meta"]["extractedLength"] == len(SAMPLE_RESUME_TEXT)


@pytest.mark.asyncio
async def test_400_missing_resume_text():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/resume/questions", json={})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_400_empty_resume_text():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/resume/questions",
            json={"resumeText": ""},
        )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_500_llm_error():
    fake = MagicMock()
    fake.chat.completions.create.side_effect = Exception("API 오류")
    with patch("app.services.llm_service.OpenAI", return_value=fake):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post(
                "/api/resume/questions",
                json={"resumeText": SAMPLE_RESUME_TEXT},
            )
    assert resp.status_code == 500
