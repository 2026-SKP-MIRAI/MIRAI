import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class AsyncStreamMock:
    """AsyncOpenAI streaming mock — chunks는 content 문자열 목록."""

    def __init__(self, chunks: list[str]):
        self.chunks = chunks

    def __aiter__(self):
        return self._gen()

    async def _gen(self):
        for text in self.chunks:
            choice = MagicMock()
            choice.delta.content = text if text != "" else None
            chunk = MagicMock()
            chunk.choices = [choice] if text != "" else []
            yield chunk


def make_async_stream_mock(chunks: list[str]):
    return AsyncStreamMock(chunks)


@pytest.mark.asyncio
async def test_call_llm_stream_yields_3_chunks():
    """3개 content chunk → 정확히 3번 yield."""
    from app.services.llm_client import call_llm_stream

    stream_mock = make_async_stream_mock(["안녕", "하세", "요"])
    fake_client = MagicMock()
    fake_client.chat.completions.create = AsyncMock(return_value=stream_mock)

    with patch("app.services.llm_client._get_async_client", return_value=fake_client):
        tokens = []
        async for token in call_llm_stream("테스트 프롬프트"):
            tokens.append(token)

    assert tokens == ["안녕", "하세", "요"]


@pytest.mark.asyncio
async def test_call_llm_stream_skips_empty_content():
    """빈 content chunk(None 또는 choices=[])는 yield 안 함."""
    from app.services.llm_client import call_llm_stream

    stream_mock = make_async_stream_mock(["첫", "", "번째"])
    fake_client = MagicMock()
    fake_client.chat.completions.create = AsyncMock(return_value=stream_mock)

    with patch("app.services.llm_client._get_async_client", return_value=fake_client):
        tokens = []
        async for token in call_llm_stream("테스트"):
            tokens.append(token)

    assert tokens == ["첫", "번째"]


@pytest.mark.asyncio
async def test_call_llm_stream_raises_llm_error_on_exception():
    """API 예외 → LLMError raise."""
    from app.parsers.exceptions import LLMError
    from app.services.llm_client import call_llm_stream

    fake_client = MagicMock()
    fake_client.chat.completions.create = AsyncMock(side_effect=Exception("API 오류"))

    with patch("app.services.llm_client._get_async_client", return_value=fake_client):
        with pytest.raises(LLMError):
            async for _ in call_llm_stream("테스트"):
                pass
