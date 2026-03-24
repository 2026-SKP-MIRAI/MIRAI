import json
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app

FIXTURES_OUTPUT = Path(__file__).parent.parent / "fixtures/output"
MOCK_REPORT_JSON = (FIXTURES_OUTPUT / "mock_report_response.json").read_text(encoding="utf-8")
MOCK_HISTORY = json.loads((FIXTURES_OUTPUT / "mock_history_5items.json").read_text(encoding="utf-8"))

# v2: LLM은 피드백 텍스트만 반환
MOCK_V2_FEEDBACK_JSON = json.dumps({
    "summary": "지원자는 전반적으로 우수한 역량을 보여주었습니다.",
    "axisFeedbacks": [
        {"axis": "communication",   "axisLabel": "의사소통",    "feedback": "명확한 구조로 의사소통 능력을 보여주었습니다."},
        {"axis": "leadership",      "axisLabel": "리더십",      "feedback": "주도적 행동 표현을 부각해 주세요."},
        {"axis": "problemSolving",  "axisLabel": "문제해결",    "feedback": "대안 검토를 더 구체적으로 제시해 주세요."},
        {"axis": "logicalThinking", "axisLabel": "논리적 사고", "feedback": "논리적 인과관계가 잘 드러났습니다."},
        {"axis": "jobExpertise",    "axisLabel": "직무 전문성", "feedback": "수치 기반 성과로 전문성을 잘 보여주었습니다."},
        {"axis": "cultureFit",      "axisLabel": "조직 적합성", "feedback": "협업 태도가 잘 드러났습니다."},
        {"axis": "creativity",      "axisLabel": "창의성",      "feedback": "다양한 대안을 검토한 경험을 제시해 주세요."},
        {"axis": "sincerity",       "axisLabel": "성실성",      "feedback": "충분한 분량으로 성실성이 잘 드러났습니다."},
    ],
}, ensure_ascii=False)


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


def make_empty_history_body(n: int = 5):
    """모든 답변이 빈 문자열인 요청 바디."""
    return {
        "resumeText": "테스트 이력서 내용입니다.",
        "history": [
            {"persona": "hr", "personaLabel": "HR 담당자", "question": f"질문{i}", "answer": ""}
            for i in range(n)
        ],
    }


# ── 200 테스트 ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_report_200_returns_8_axes():
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(MOCK_V2_FEEDBACK_JSON)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/report/generate", json=make_request_body(5))
    assert resp.status_code == 200
    data = resp.json()
    assert "scores" in data
    assert len(data["axisFeedbacks"]) == 8
    assert "usage" in data


@pytest.mark.asyncio
async def test_generate_report_200_axis_feedbacks_count_is_8():
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(MOCK_V2_FEEDBACK_JSON)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/report/generate", json=make_request_body(5))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["axisFeedbacks"]) == 8
    axes = {fb["axis"] for fb in data["axisFeedbacks"]}
    assert len(axes) == 8


@pytest.mark.asyncio
async def test_generate_report_200_scores_within_0_to_100_or_null():
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(MOCK_V2_FEEDBACK_JSON)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/report/generate", json=make_request_body(5))
    assert resp.status_code == 200
    data = resp.json()
    for key, val in data["scores"].items():
        assert val is None or 0 <= val <= 100, f"{key} 점수 범위 위반: {val}"
    assert 0 <= data["totalScore"] <= 100


@pytest.mark.asyncio
async def test_generate_report_200_signals_field_included():
    """정상 답변 히스토리 → 응답 최상위에 signals 필드 포함."""
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(MOCK_V2_FEEDBACK_JSON)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/report/generate", json=make_request_body(5))
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("signals") is not None
    assert "star_score" in data["signals"]


@pytest.mark.asyncio
async def test_generate_report_200_not_evaluated_when_all_empty():
    """빈 답변 히스토리 → 전 축 not_evaluated, totalScore=0."""
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(MOCK_V2_FEEDBACK_JSON)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/report/generate", json=make_empty_history_body(5))
    assert resp.status_code == 200
    data = resp.json()
    for fb in data["axisFeedbacks"]:
        assert fb["type"] == "not_evaluated"
        assert fb["score"] is None
    assert data["totalScore"] == 0


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


@pytest.mark.asyncio
async def test_generate_report_200_not_evaluated_excluded_from_total_score():
    """not_evaluated(None) 축이 포함되어도 totalScore는 평가된 축만으로 계산."""
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(MOCK_V2_FEEDBACK_JSON)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/report/generate", json=make_request_body(5))
    assert resp.status_code == 200
    data = resp.json()
    evaluated_scores = [v for v in data["scores"].values() if v is not None]
    if evaluated_scores:
        expected = round(sum(evaluated_scores) / len(evaluated_scores))
        assert abs(data["totalScore"] - expected) <= 1  # 반올림 오차 허용
