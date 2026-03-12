import inspect
from unittest.mock import MagicMock, patch


def make_mock_llm(content: str = "response"):
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=content))
    ]
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
