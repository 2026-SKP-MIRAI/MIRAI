import json
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.parsers.exceptions import LLMError

FIXTURES_OUTPUT = Path(__file__).parent.parent / "fixtures/output"
MOCK_PRACTICE_SINGLE = (FIXTURES_OUTPUT / "mock_practice_feedback_single.json").read_text(encoding="utf-8")
MOCK_PRACTICE_RETRY = (FIXTURES_OUTPUT / "mock_practice_feedback_retry.json").read_text(encoding="utf-8")


def mock_llm(content: str):
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=content))
    ]
    return fake


# ── 200 테스트 ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_practice_feedback_200_single():
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(MOCK_PRACTICE_SINGLE)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/practice/feedback", json={"question": "q", "answer": "a"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["comparisonDelta"] is None
    assert "score" in data
    assert "feedback" in data
    assert "keywords" in data
    assert "improvedAnswerGuide" in data


@pytest.mark.asyncio
async def test_practice_feedback_200_with_previous_answer():
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(MOCK_PRACTICE_RETRY)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/practice/feedback", json={
                "question": "q",
                "answer": "a",
                "previousAnswer": "prev",
            })
    assert resp.status_code == 200
    data = resp.json()
    assert data["comparisonDelta"] is not None
    assert isinstance(data["comparisonDelta"]["scoreDelta"], int)


# ── 400 테스트 ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_practice_feedback_400_missing_question():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/practice/feedback", json={})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_practice_feedback_400_missing_answer():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/practice/feedback", json={"question": "q"})
    assert resp.status_code == 400


# ── 500 테스트 ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_practice_feedback_500_llm_error():
    fake = MagicMock()
    fake.chat.completions.create.side_effect = LLMError("LLM 오류")
    with patch("app.services.llm_client.OpenAI", return_value=fake):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/practice/feedback", json={"question": "q", "answer": "a"})
    assert resp.status_code == 500
