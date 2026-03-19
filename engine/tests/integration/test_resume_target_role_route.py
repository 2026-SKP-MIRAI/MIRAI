import pytest
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_200_target_role_success():
    with patch("app.routers.resume.extract_target_role", return_value="경영기획"):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/resume/target-role", json={"resumeText": "경영기획 직무에 지원합니다."})
    assert resp.status_code == 200
    assert resp.json()["targetRole"] == "경영기획"


@pytest.mark.asyncio
async def test_200_target_role_fallback_when_undetectable():
    with patch("app.routers.resume.extract_target_role", return_value="미지정"):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/resume/target-role", json={"resumeText": "직무 불명확한 자소서."})
    assert resp.status_code == 200
    assert resp.json()["targetRole"] == "미지정"


@pytest.mark.asyncio
async def test_400_missing_resume_text():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/resume/target-role", json={})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_400_empty_resume_text():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/resume/target-role", json={"resumeText": ""})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_500_llm_error():
    from app.parsers.exceptions import LLMError
    with patch("app.routers.resume.extract_target_role", side_effect=LLMError("API 오류")):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/resume/target-role", json={"resumeText": "자소서 내용"})
    assert resp.status_code == 500
