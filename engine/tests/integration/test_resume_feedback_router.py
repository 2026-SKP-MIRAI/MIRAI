import json
import pytest
from unittest.mock import MagicMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.parsers.exceptions import LLMError


MOCK_FEEDBACK = json.dumps({
    "scores": {
        "specificity": 72, "achievementClarity": 65,
        "logicStructure": 80, "roleAlignment": 88, "differentiation": 60,
    },
    "strengths": ["직무 연관성이 명확합니다", "논리 구조가 잘 갖춰져 있습니다"],
    "weaknesses": ["수치 근거가 부족합니다", "차별화 요소가 약합니다"],
    "suggestions": [
        {"section": "성장 경험", "issue": "수치 근거 없음", "suggestion": "30% 개선 등 수치 추가 권장"}
    ],
})


def mock_llm(content: str):
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=content))
    ]
    return fake


# ── 200 테스트 ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_resume_feedback_200_full_fields():
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(MOCK_FEEDBACK)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/resume/feedback", json={
                "resumeText": "자소서 내용입니다.",
                "targetRole": "백엔드 개발자",
            })
    assert resp.status_code == 200
    data = resp.json()
    assert "scores" in data
    assert "strengths" in data
    assert "weaknesses" in data
    assert "suggestions" in data


@pytest.mark.asyncio
async def test_resume_feedback_200_scores_five_keys():
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(MOCK_FEEDBACK)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/resume/feedback", json={
                "resumeText": "자소서 내용입니다.",
                "targetRole": "백엔드 개발자",
            })
    assert resp.status_code == 200
    scores = resp.json()["scores"]
    assert "specificity" in scores
    assert "achievementClarity" in scores
    assert "logicStructure" in scores
    assert "roleAlignment" in scores
    assert "differentiation" in scores


# ── 400 테스트 ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_resume_feedback_400_missing_resume_text():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/resume/feedback", json={"targetRole": "백엔드 개발자"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_resume_feedback_400_missing_target_role():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/resume/feedback", json={"resumeText": "자소서 내용"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_resume_feedback_400_empty_resume_text():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/resume/feedback", json={
            "resumeText": "", "targetRole": "백엔드 개발자",
        })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_resume_feedback_400_empty_target_role():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/resume/feedback", json={
            "resumeText": "자소서 내용", "targetRole": "",
        })
    assert resp.status_code == 400


# ── 500 테스트 ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_resume_feedback_500_llm_error():
    fake = MagicMock()
    fake.chat.completions.create.side_effect = LLMError("LLM 오류")
    with patch("app.services.llm_client.OpenAI", return_value=fake):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/resume/feedback", json={
                "resumeText": "자소서 내용", "targetRole": "백엔드 개발자",
            })
    assert resp.status_code == 500


@pytest.mark.asyncio
async def test_resume_feedback_500_parse_error():
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm("not json")):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/resume/feedback", json={
                "resumeText": "자소서 내용", "targetRole": "백엔드 개발자",
            })
    assert resp.status_code == 500


@pytest.mark.asyncio
async def test_resume_feedback_200_empty_suggestions_uses_fallback():
    no_sug = json.dumps({
        "scores": {
            "specificity": 72, "achievementClarity": 65,
            "logicStructure": 80, "roleAlignment": 88, "differentiation": 60,
        },
        "strengths": ["강점1", "강점2"],
        "weaknesses": ["약점1", "약점2"],
        "suggestions": [],
    })
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(no_sug)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/resume/feedback", json={
                "resumeText": "자소서 내용", "targetRole": "백엔드 개발자",
            })
    assert resp.status_code == 200
    assert len(resp.json()["suggestions"]) >= 1
