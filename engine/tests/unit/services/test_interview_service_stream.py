import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.schemas import QueueItem


FOLLOWUP_JSON = '{"shouldFollowUp": true, "followupQuestion": "더 설명해 주세요.", "reasoning": "모호합니다."}'
NO_FOLLOWUP_JSON = '{"shouldFollowUp": false}'
NEXT_Q_JSON = '{"question": "다음 질문입니다.", "personaLabel": "기술팀장"}'


def _parse_sse_events(events: list[str]) -> list[dict]:
    result = []
    for e in events:
        if e.startswith("data: "):
            result.append(json.loads(e[len("data: "):].strip()))
    return result


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
async def test_stream_path_a_turn_limit():
    """Path A: 턴 제한 → token 0개 + done(sessionComplete=True)."""
    from app.services.interview_service import process_answer_stream, MAX_TURNS

    history = [
        MagicMock(persona="hr") for _ in range(MAX_TURNS - 1)
    ]
    events = []
    async for e in process_answer_stream(
        "이력서", history, [MagicMock(persona="tech_lead", type="main")],
        "질문", "hr", "답변"
    ):
        events.append(e)

    parsed = _parse_sse_events(events)
    assert len(parsed) == 1
    assert parsed[0]["type"] == "done"
    assert parsed[0]["sessionComplete"] is True
    assert parsed[0]["nextQuestion"] is None


@pytest.mark.asyncio
async def test_stream_path_a_empty_queue():
    """Path A: 큐 비어있음 → done(sessionComplete=True)."""
    from app.services.interview_service import process_answer_stream

    events = []
    async for e in process_answer_stream(
        "이력서", [], [], "질문", "hr", "답변"
    ):
        events.append(e)

    parsed = _parse_sse_events(events)
    assert len(parsed) == 1
    assert parsed[0]["type"] == "done"
    assert parsed[0]["sessionComplete"] is True


@pytest.mark.asyncio
async def test_stream_path_b_followup_true():
    """Path B: shouldFollowUp=True → 질문 텍스트 token N개 + done(follow_up)."""
    from app.services.interview_service import process_answer_stream

    followup_result = ({"shouldFollowUp": True, "followupQuestion": "더 설명해 주세요."}, None, "")
    queue_item = QueueItem(persona="tech_lead", type="main")

    with patch("app.services.interview_service._check_followup", return_value=followup_result), \
         patch("asyncio.sleep", return_value=None):
        events = []
        async for e in process_answer_stream(
            "이력서",
            [MagicMock(persona="hr")],
            [queue_item],
            "질문", "hr", "모호한 답변"
        ):
            events.append(e)

    parsed = _parse_sse_events(events)
    token_events = [p for p in parsed if p["type"] == "token"]
    done_events = [p for p in parsed if p["type"] == "done"]

    # Path B도 이제 token 스트리밍: "더 설명해 주세요." = 4단어
    assert len(token_events) >= 1
    reconstructed = "".join(t["text"] for t in token_events)
    assert "더" in reconstructed
    assert len(done_events) == 1
    assert done_events[0]["sessionComplete"] is False
    assert done_events[0]["nextQuestion"]["type"] == "follow_up"


@pytest.mark.asyncio
async def test_stream_path_c_next_question():
    """Path C: shouldFollowUp=False → JSON silent 수집 후 question 텍스트만 token N개 + done."""
    from app.services.interview_service import process_answer_stream

    no_followup_result = ({"shouldFollowUp": False}, None, "")
    # LLM이 JSON 전체를 한 토큰으로 반환하는 시나리오
    async_stream = make_async_stream_mock(['{"question": "다음 질문입니다.", "personaLabel": "기술팀장"}'])
    async_client_mock = MagicMock()
    async_client_mock.chat.completions.create = AsyncMock(return_value=async_stream)

    queue_item = QueueItem(persona="tech_lead", type="main")

    with patch("app.services.interview_service._check_followup", return_value=no_followup_result), \
         patch("app.services.llm_client._get_async_client", return_value=async_client_mock), \
         patch("asyncio.sleep", return_value=None):
        events = []
        async for e in process_answer_stream(
            "이력서",
            [MagicMock(persona="hr")],
            [queue_item],
            "질문", "hr", "구체적인 답변"
        ):
            events.append(e)

    parsed = _parse_sse_events(events)
    token_events = [p for p in parsed if p["type"] == "token"]
    done_events = [p for p in parsed if p["type"] == "done"]

    assert len(token_events) >= 1
    # token은 JSON 키가 아닌 사람이 읽을 수 있는 텍스트여야 함
    reconstructed = "".join(t["text"] for t in token_events)
    assert "다음" in reconstructed
    assert "{" not in reconstructed  # JSON 원문이 노출되지 않아야 함
    assert len(done_events) == 1
    assert done_events[0]["sessionComplete"] is False
    assert done_events[0]["nextQuestion"]["question"] == "다음 질문입니다."


@pytest.mark.asyncio
async def test_stream_error_event_on_exception():
    """예외 발생 → error 이벤트."""
    from app.services.interview_service import process_answer_stream

    queue_item = QueueItem(persona="tech_lead", type="main")

    with patch("app.services.interview_service._check_followup", side_effect=Exception("LLM 오류")):
        events = []
        async for e in process_answer_stream(
            "이력서",
            [MagicMock(persona="hr")],
            [queue_item],
            "질문", "hr", "답변"
        ):
            events.append(e)

    parsed = _parse_sse_events(events)
    assert any(p["type"] == "error" for p in parsed)
