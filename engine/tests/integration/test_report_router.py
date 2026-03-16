import json
import pytest
from unittest.mock import MagicMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app


def mock_llm(content: str):
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=content))
    ]
    return fake


def _report_json() -> str:
    return json.dumps({
        "scores": {
            "communication": 80, "problemSolving": 75, "logicalThinking": 70,
            "jobExpertise": 85, "cultureFit": 65, "leadership": 60,
            "creativity": 72, "sincerity": 88,
        },
        "summary": "전반적으로 우수한 역량을 보여주었습니다.",
        "axisFeedbacks": [
            {"axis": "communication",   "axisLabel": "의사소통",    "score": 80, "type": "strength",    "feedback": "의사소통 능력이 우수합니다."},
            {"axis": "problemSolving",  "axisLabel": "문제해결",    "score": 75, "type": "strength",    "feedback": "문제해결 능력이 좋습니다."},
            {"axis": "logicalThinking", "axisLabel": "논리적 사고", "score": 70, "type": "improvement", "feedback": "논리적 사고를 더 발전시키세요."},
            {"axis": "jobExpertise",    "axisLabel": "직무 전문성", "score": 85, "type": "strength",    "feedback": "직무 전문성이 뛰어납니다."},
            {"axis": "cultureFit",      "axisLabel": "조직 적합성", "score": 65, "type": "improvement", "feedback": "조직 적합성을 높이세요."},
            {"axis": "leadership",      "axisLabel": "리더십",      "score": 60, "type": "improvement", "feedback": "리더십을 더 키우세요."},
            {"axis": "creativity",      "axisLabel": "창의성",      "score": 72, "type": "improvement", "feedback": "창의성을 발휘하세요."},
            {"axis": "sincerity",       "axisLabel": "성실성",      "score": 88, "type": "strength",    "feedback": "성실성이 매우 뛰어납니다."},
        ],
    })


def make_history_dicts(n: int = 5) -> list[dict]:
    return [
        {"persona": "hr", "personaLabel": "HR 담당자", "question": f"질문 {i+1}", "answer": f"답변 {i+1}"}
        for i in range(n)
    ]


def make_request_body(history_count: int = 5) -> dict:
    return {
        "resumeText": "테스트 이력서 내용입니다.",
        "history": make_history_dicts(history_count),
    }


# ── 200 테스트 (3개) ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_report_200_returns_8_axes():
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(_report_json())):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/report/generate", json=make_request_body(5))
    assert resp.status_code == 200
    data = resp.json()
    assert "scores" in data
    assert len(data["axisFeedbacks"]) == 8


@pytest.mark.asyncio
async def test_generate_report_200_axis_feedbacks_count_is_8():
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(_report_json())):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/report/generate", json=make_request_body(5))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["axisFeedbacks"]) == 8
    axes = {fb["axis"] for fb in data["axisFeedbacks"]}
    assert len(axes) == 8


@pytest.mark.asyncio
async def test_generate_report_200_scores_all_within_0_to_100():
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(_report_json())):
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
        resp = await ac.post("/api/report/generate", json=make_request_body(1))
    assert resp.status_code == 422


# ── 400 테스트 (2개) ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_report_400_missing_resume_text():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/report/generate", json={
            "history": make_history_dicts(5),
        })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_generate_report_400_missing_history():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/report/generate", json={
            "resumeText": "이력서 내용",
        })
    assert resp.status_code == 400


# ── 500 테스트 (2개) ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_report_500_llm_error():
    fake = MagicMock()
    fake.chat.completions.create.side_effect = Exception("API 오류")
    with patch("app.services.llm_client.OpenAI", return_value=fake):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/report/generate", json=make_request_body(5))
    assert resp.status_code == 500


@pytest.mark.asyncio
async def test_generate_report_500_parse_error():
    invalid = json.dumps({
        "scores": {"communication": 150},
        "summary": "summary",
        "axisFeedbacks": [],
    })
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(invalid)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/report/generate", json=make_request_body(5))
    assert resp.status_code == 500
