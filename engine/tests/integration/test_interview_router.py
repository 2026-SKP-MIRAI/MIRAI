import pytest
from unittest.mock import MagicMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app

HR_Q = '{"question": "HR 질문입니다.", "personaLabel": "HR 담당자"}'
TECH_Q = '{"question": "기술 질문입니다.", "personaLabel": "기술팀장"}'
FOLLOWUP_JSON = '{"shouldFollowUp": true, "followupType": "CLARIFY", "followupQuestion": "더 설명해 주세요.", "reasoning": "모호합니다."}'
NO_FOLLOWUP_JSON = '{"shouldFollowUp": false, "followupType": "CLARIFY", "followupQuestion": "...", "reasoning": "충분합니다."}'


def mock_llm(content: str):
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=content))
    ]
    return fake


def mock_llm_side_effect(contents: list[str]):
    fake = MagicMock()
    fake.chat.completions.create.side_effect = [
        MagicMock(choices=[MagicMock(message=MagicMock(content=c))]) for c in contents
    ]
    return fake


@pytest.mark.asyncio
async def test_start_200_returns_first_question_and_queue():
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(HR_Q)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/interview/start", json={
                "resumeText": "테스트 이력서",
                "personas": ["hr", "tech_lead", "executive"],
                "mode": "panel",
            })
    assert resp.status_code == 200
    data = resp.json()
    assert "firstQuestion" in data
    assert data["firstQuestion"]["persona"] == "hr"
    assert len(data["questionsQueue"]) == 9


@pytest.mark.asyncio
async def test_start_400_missing_resume_text():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/interview/start", json={
            "personas": ["hr"],
            "mode": "panel",
        })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_start_400_empty_resume_text():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/interview/start", json={
            "resumeText": "",
            "personas": ["hr"],
            "mode": "panel",
        })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_answer_200_next_question():
    # LLM 2회: 1) followup check (no followup), 2) next question
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm_side_effect([NO_FOLLOWUP_JSON, TECH_Q])):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/interview/answer", json={
                "resumeText": "이력서",
                "history": [{"persona": "hr", "personaLabel": "HR 담당자", "question": "질문", "answer": "답변"}],
                "questionsQueue": [{"persona": "tech_lead", "type": "main"}],
                "currentQuestion": "현재 질문",
                "currentPersona": "hr",
                "currentAnswer": "내 답변",
            })
    assert resp.status_code == 200
    data = resp.json()
    assert data["sessionComplete"] is False
    assert data["nextQuestion"] is not None


@pytest.mark.asyncio
async def test_answer_200_session_complete():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/interview/answer", json={
            "resumeText": "이력서",
            "history": [],
            "questionsQueue": [],
            "currentQuestion": "현재 질문",
            "currentPersona": "hr",
            "currentAnswer": "마지막 답변",
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["sessionComplete"] is True
    assert data["nextQuestion"] is None


@pytest.mark.asyncio
async def test_answer_400_missing_fields():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/interview/answer", json={
            "history": [],
            "questionsQueue": [],
        })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_answer_200_followup():
    # shouldFollowUp=True → nextQuestion.type == "follow_up", updatedQueue 변경 없음
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(FOLLOWUP_JSON)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/interview/answer", json={
                "resumeText": "이력서",
                "history": [{"persona": "hr", "personaLabel": "HR 담당자", "question": "질문", "answer": "답변"}],
                "questionsQueue": [{"persona": "tech_lead", "type": "main"}],
                "currentQuestion": "현재 질문",
                "currentPersona": "hr",
                "currentAnswer": "모호한 답변",
            })
    assert resp.status_code == 200
    data = resp.json()
    assert data["sessionComplete"] is False
    assert data["nextQuestion"]["type"] == "follow_up"
    assert data["nextQuestion"]["persona"] == "hr"
    assert len(data["updatedQueue"]) == 1  # 큐 변경 없음


@pytest.mark.asyncio
async def test_answer_200_session_complete_at_max_turns():
    from app.services.interview_service import MAX_TURNS
    # history 9개 → sessionComplete=True, LLM 호출 없음
    history = [
        {"persona": "hr", "personaLabel": "HR 담당자", "question": f"질문{i}", "answer": f"답변{i}"}
        for i in range(MAX_TURNS - 1)
    ]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/interview/answer", json={
            "resumeText": "이력서",
            "history": history,
            "questionsQueue": [{"persona": "tech_lead", "type": "main"}],
            "currentQuestion": "현재 질문",
            "currentPersona": "hr",
            "currentAnswer": "답변",
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["sessionComplete"] is True
    assert data["nextQuestion"] is None


@pytest.mark.asyncio
async def test_followup_200():
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(FOLLOWUP_JSON)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/interview/followup", json={
                "question": "팀워크 경험을 말해주세요.",
                "answer": "팀에서 일했습니다.",
                "persona": "hr",
                "resumeText": "이력서",
            })
    assert resp.status_code == 200
    data = resp.json()
    assert data["followupType"] in ["CLARIFY", "CHALLENGE", "EXPLORE"]
    assert "followupQuestion" in data
    assert "reasoning" in data


@pytest.mark.asyncio
async def test_followup_400_missing_fields():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/interview/followup", json={
            "question": "질문",
            "answer": "답변",
        })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_500_llm_error():
    fake = MagicMock()
    fake.chat.completions.create.side_effect = Exception("API 오류")
    with patch("app.services.llm_client.OpenAI", return_value=fake):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/interview/start", json={
                "resumeText": "이력서",
                "personas": ["hr"],
                "mode": "panel",
            })
    assert resp.status_code == 500
