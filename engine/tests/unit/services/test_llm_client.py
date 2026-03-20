import inspect
import pytest
from unittest.mock import MagicMock, patch


def make_mock_llm(content: str = "response"):
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=content))
    ]
    fake.chat.completions.create.return_value.usage = MagicMock(
        prompt_tokens=10, completion_tokens=5, total_tokens=15
    )
    fake.chat.completions.create.return_value.model = "google/gemini-2.5-flash"
    return fake


def test_call_llm_default_max_tokens_is_2048():
    from app.services.llm_client import call_llm
    sig = inspect.signature(call_llm)
    assert sig.parameters["max_tokens"].default == 2048


def test_call_llm_passes_max_tokens_2048_by_default():
    fake = make_mock_llm()
    with patch("app.services.llm_client.OpenAI", return_value=fake):
        from app.services.llm_client import call_llm
        call_llm("테스트 프롬프트")
    _, kwargs = fake.chat.completions.create.call_args
    assert kwargs["max_tokens"] == 2048


def test_call_llm_passes_custom_max_tokens():
    fake = make_mock_llm()
    with patch("app.services.llm_client.OpenAI", return_value=fake):
        from app.services.llm_client import call_llm
        call_llm("테스트 프롬프트", max_tokens=4096)
    _, kwargs = fake.chat.completions.create.call_args
    assert kwargs["max_tokens"] == 4096


def test_call_llm_returns_llm_result_with_content():
    """call_llm이 LLMResult를 반환하고 content가 올바른지 확인."""
    from app.services.llm_client import call_llm, LLMResult
    fake = make_mock_llm("테스트 응답")
    with patch("app.services.llm_client.OpenAI", return_value=fake):
        result = call_llm("테스트 프롬프트")
    assert isinstance(result, LLMResult)
    assert result.content == "테스트 응답"


def test_call_llm_returns_usage_info():
    """call_llm이 usage 정보를 포함한 LLMResult를 반환한다."""
    from app.services.llm_client import call_llm, LLMResult
    fake = make_mock_llm()
    with patch("app.services.llm_client.OpenAI", return_value=fake):
        result = call_llm("테스트 프롬프트")
    assert result.usage is not None
    assert result.usage.prompt_tokens == 10
    assert result.usage.completion_tokens == 5
    assert result.usage.total_tokens == 15


def test_call_llm_usage_none_when_api_returns_no_usage():
    """API가 usage=None을 반환하면 LLMResult.usage도 None이어야 한다."""
    from app.services.llm_client import call_llm
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content="응답"))
    ]
    fake.chat.completions.create.return_value.usage = None
    with patch("app.services.llm_client.OpenAI", return_value=fake):
        result = call_llm("테스트 프롬프트")
    assert result.usage is None
    assert result.content == "응답"


def test_call_llm_content_none_raises_llm_error():
    """choices[0].message.content가 None이면 LLMError가 발생해야 한다."""
    from app.parsers.exceptions import LLMError
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=None))
    ]
    with patch("app.services.llm_client.OpenAI", return_value=fake):
        from app.services.llm_client import call_llm
        with pytest.raises(LLMError):
            call_llm("테스트 프롬프트")


def test_call_llm_llm_error_not_double_wrapped():
    """LLMError가 내부에서 발생해도 그대로 재전파되고 다른 LLMError로 래핑되지 않는다."""
    from app.parsers.exceptions import LLMError
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=None))
    ]
    # content=None → raise LLMError("...error_message..."), __cause__ 없음
    with patch("app.services.llm_client.OpenAI", return_value=fake):
        from app.services.llm_client import call_llm
        with pytest.raises(LLMError) as exc_info:
            call_llm("테스트 프롬프트", error_message="커스텀 오류 메시지")
    # __cause__ 가 없어야 한다 — 다른 예외에서 파생되지 않음을 확인
    assert exc_info.value.__cause__ is None
