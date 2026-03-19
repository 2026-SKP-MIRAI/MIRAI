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
    fake.chat.completions.create.return_value.usage = MagicMock(
        prompt_tokens=10, completion_tokens=5, total_tokens=15
    )
    return fake


@pytest.mark.asyncio
async def test_200_success():
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm_success()):
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
    assert "usage" in data


@pytest.mark.asyncio
async def test_200_meta_extracted_length():
    """meta.extractedLength는 전달된 resumeText 길이와 같아야 한다"""
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm_success()):
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
async def test_400_resume_text_too_long():
    """resumeText 50,001자 → 400"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/resume/questions",
            json={"resumeText": "가" * 50_001},
        )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_200_resume_text_max_length():
    """resumeText 정확히 50,000자 → 200 (경계값)"""
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm_success()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post(
                "/api/resume/questions",
                json={"resumeText": "가" * 50_000},
            )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_500_llm_error():
    fake = MagicMock()
    fake.chat.completions.create.side_effect = Exception("API 오류")
    with patch("app.services.llm_client.OpenAI", return_value=fake):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post(
                "/api/resume/questions",
                json={"resumeText": SAMPLE_RESUME_TEXT},
            )
    assert resp.status_code == 500


@pytest.mark.asyncio
async def test_200_with_target_role():
    """targetRole 전달 시 200 반환"""
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm_success()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post(
                "/api/resume/questions",
                json={"resumeText": SAMPLE_RESUME_TEXT, "targetRole": "백엔드 개발자"},
            )
    assert resp.status_code == 200
    data = resp.json()
    assert "questions" in data


@pytest.mark.asyncio
async def test_200_with_empty_target_role():
    """targetRole="" 전달 시 None과 동일하게 처리 — 200 반환"""
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm_success()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post(
                "/api/resume/questions",
                json={"resumeText": SAMPLE_RESUME_TEXT, "targetRole": ""},
            )
    assert resp.status_code == 200
    data = resp.json()
    assert "questions" in data


@pytest.mark.asyncio
async def test_400_target_role_too_long():
    """targetRole 101자 초과 → 400"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/resume/questions",
            json={"resumeText": SAMPLE_RESUME_TEXT, "targetRole": "a" * 101},
        )
    assert resp.status_code == 400
