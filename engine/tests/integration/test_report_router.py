import json
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app

FIXTURES_OUTPUT = Path(__file__).parent.parent / "fixtures/output"
MOCK_REPORT_JSON = (FIXTURES_OUTPUT / "mock_report_response.json").read_text(encoding="utf-8")
MOCK_HISTORY = json.loads((FIXTURES_OUTPUT / "mock_history_5items.json").read_text(encoding="utf-8"))


def mock_llm(content: str):
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=content))
    ]
    fake.chat.completions.create.return_value.usage = MagicMock(
        prompt_tokens=10, completion_tokens=5, total_tokens=15
    )
    return fake


def make_request_body(history_count: int = 5):
    return {
        "resumeText": "테스트 이력서 내용입니다.",
        "history": MOCK_HISTORY[:history_count],
    }


# ── 200 테스트 (3개) ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_report_200_returns_8_axes():
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(MOCK_REPORT_JSON)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/report/generate", json=make_request_body(5))
    assert resp.status_code == 200
    data = resp.json()
    assert "scores" in data
    assert len(data["axisFeedbacks"]) == 8
    assert "usage" in data


@pytest.mark.asyncio
async def test_generate_report_200_axis_feedbacks_count_is_8():
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(MOCK_REPORT_JSON)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/report/generate", json=make_request_body(5))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["axisFeedbacks"]) == 8
    axes = {fb["axis"] for fb in data["axisFeedbacks"]}
    assert len(axes) == 8


@pytest.mark.asyncio
async def test_generate_report_200_scores_all_within_0_to_100():
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(MOCK_REPORT_JSON)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/report/generate", json=make_request_body(5))
    assert resp.status_code == 200
    data = resp.json()
    for key, val in data["scores"].items():
        assert 0 <= val <= 100, f"{key} 점수 범위 위반: {val}"
    assert 0 <= data["totalScore"] <= 100


# ── 422 테스트 (2개) ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_report_422_history_less_than_5():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/report/generate", json=make_request_body(4))
    assert resp.status_code == 422
    assert "detail" in resp.json()


@pytest.mark.asyncio
async def test_generate_report_422_history_one_item():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/report/generate", json={
            "resumeText": "이력서",
            "history": [MOCK_HISTORY[0]],  # 1개 (5개 미만 → 422)
        })
    assert resp.status_code == 422


# ── 400 테스트 (2개) ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_report_400_missing_resume_text():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/report/generate", json={
            "history": MOCK_HISTORY[:5],
        })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_generate_report_400_missing_history():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/report/generate", json={
            "resumeText": "이력서 내용",
        })
    assert resp.status_code == 400


# ── 500 테스트 (1개) ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_report_500_llm_error():
    fake = MagicMock()
    fake.chat.completions.create.side_effect = Exception("API 오류")
    with patch("app.services.llm_client.OpenAI", return_value=fake):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/report/generate", json=make_request_body(5))
    assert resp.status_code == 500
