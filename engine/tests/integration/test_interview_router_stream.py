import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport
import app.services.interview_service as _interview_svc  # noqa: F401 — ensure module loaded for patching
from app.main import app

NO_FOLLOWUP_JSON = '{"shouldFollowUp": false}'
NEXT_Q_JSON = '{"question": "다음 질문입니다.", "personaLabel": "기술팀장"}'

ANSWER_PAYLOAD = {
    "resumeText": "이력서",
    "history": [{"persona": "hr", "personaLabel": "HR 담당자", "question": "질문", "answer": "답변"}],
    "questionsQueue": [{"persona": "tech_lead", "type": "main"}],
    "currentQuestion": "현재 질문",
    "currentPersona": "hr",
    "currentAnswer": "내 답변",
}


def make_sync_llm_mock(content: str):
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=content))
    ]
    fake.chat.completions.create.return_value.usage = MagicMock(
        prompt_tokens=10, completion_tokens=5, total_tokens=15
    )
    return fake


class AsyncStreamMock:
    def __init__(self, tokens: list[str]):
        self.tokens = tokens

    def __aiter__(self):
        return self._gen()

    async def _gen(self):
        for text in self.tokens:
            choice = MagicMock()
            choice.delta.content = text
            chunk = MagicMock()
            chunk.choices = [choice]
            yield chunk


def make_async_stream_mock(tokens: list[str]):
    return AsyncStreamMock(tokens)


@pytest.mark.asyncio
async def test_answer_stream_content_type():
    """POST /api/interview/answer?stream=true → Content-Type: text/event-stream."""
    no_followup_result = ({"shouldFollowUp": False}, None, "")
    async_stream = make_async_stream_mock([NEXT_Q_JSON])
    async_client_mock = MagicMock()
    async_client_mock.chat.completions.create = AsyncMock(return_value=async_stream)

    with patch("app.services.interview_service._check_followup", return_value=no_followup_result), \
         patch("app.services.llm_client._get_async_client", return_value=async_client_mock):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/interview/answer?stream=true", json=ANSWER_PAYLOAD)

    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_answer_stream_yields_done_event():
    """스트림 응답에 done 이벤트 포함."""
    no_followup_result = ({"shouldFollowUp": False}, None, "")
    async_stream = make_async_stream_mock([NEXT_Q_JSON])
    async_client_mock = MagicMock()
    async_client_mock.chat.completions.create = AsyncMock(return_value=async_stream)

    with patch("app.services.interview_service._check_followup", return_value=no_followup_result), \
         patch("app.services.llm_client._get_async_client", return_value=async_client_mock):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/interview/answer?stream=true", json=ANSWER_PAYLOAD)

    body = resp.text
    events = [
        json.loads(line[len("data: "):])
        for line in body.splitlines()
        if line.startswith("data: ")
    ]
    assert any(e["type"] == "done" for e in events)


@pytest.mark.asyncio
async def test_answer_no_stream_returns_json():
    """POST /api/interview/answer (stream 미지정) → JSON 응답."""
    sync_mock_side = MagicMock()
    usage_mock = MagicMock(prompt_tokens=10, completion_tokens=5, total_tokens=15)
    sync_mock_side.chat.completions.create.side_effect = [
        MagicMock(choices=[MagicMock(message=MagicMock(content=NO_FOLLOWUP_JSON))], usage=usage_mock),
        MagicMock(choices=[MagicMock(message=MagicMock(content=NEXT_Q_JSON))], usage=usage_mock),
    ]

    with patch("app.services.llm_client.OpenAI", return_value=sync_mock_side):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/interview/answer", json=ANSWER_PAYLOAD)

    assert resp.status_code == 200
    data = resp.json()
    assert "sessionComplete" in data
    assert "nextQuestion" in data


@pytest.mark.asyncio
async def test_answer_stream_session_complete():
    """빈 큐 + stream=true → done(sessionComplete=True)."""
    payload = {**ANSWER_PAYLOAD, "questionsQueue": [], "history": []}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/interview/answer?stream=true", json=payload)

    assert resp.status_code == 200
    body = resp.text
    events = [
        json.loads(line[len("data: "):])
        for line in body.splitlines()
        if line.startswith("data: ")
    ]
    done_events = [e for e in events if e["type"] == "done"]
    assert len(done_events) == 1
    assert done_events[0]["sessionComplete"] is True
