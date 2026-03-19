import pytest
from unittest.mock import patch
from app.services.role_service import extract_target_role
from app.parsers.exceptions import LLMError


def test_extract_target_role_success():
    with patch("app.services.role_service.call_llm", return_value='{"targetRole": "경영기획"}'):
        result = extract_target_role("경영기획 직무에 지원합니다.")
    assert result == "경영기획"


def test_extract_target_role_strips_whitespace():
    with patch("app.services.role_service.call_llm", return_value='{"targetRole": "  백엔드  "}'):
        result = extract_target_role("백엔드 개발자입니다.")
    assert result == "백엔드"


def test_extract_target_role_fallback_when_empty():
    with patch("app.services.role_service.call_llm", return_value='{"targetRole": ""}'):
        result = extract_target_role("직무를 알 수 없는 자소서.")
    assert result == "미지정"


def test_extract_target_role_fallback_when_null():
    with patch("app.services.role_service.call_llm", return_value='{"targetRole": null}'):
        result = extract_target_role("직무를 알 수 없는 자소서.")
    assert result == "미지정"


def test_extract_target_role_raises_when_resume_text_is_empty():
    with pytest.raises(LLMError):
        extract_target_role("")


def test_extract_target_role_raises_when_resume_text_is_whitespace():
    with pytest.raises(LLMError):
        extract_target_role("   ")


def test_extract_target_role_api_error():
    with patch("app.services.role_service.call_llm", side_effect=LLMError("API 오류")):
        with pytest.raises(LLMError):
            extract_target_role("자소서 내용")


def test_extract_target_role_truncates_long_text():
    long_text = "자소서 " * 10000  # 40,000자 — max_input_chars(16000) 초과
    captured = {}

    def fake_call_llm(prompt, **kwargs):
        captured["prompt"] = prompt
        return '{"targetRole": "개발자"}'

    with patch("app.services.role_service.call_llm", side_effect=fake_call_llm):
        extract_target_role(long_text, max_input_chars=16000)

    assert len(long_text) > 16000
    # 프롬프트 전체 길이가 원본보다 짧고, 잘리지 않은 원본 텍스트가 포함되지 않아야 한다
    assert len(captured["prompt"]) < len(long_text)
    assert long_text[:16001] not in captured["prompt"]  # 16001자 이상 삽입되지 않음


def test_extract_target_role_truncates_output_to_100():
    """LLM이 100자 초과 targetRole을 반환해도 100자로 잘린다."""
    long_role = "개발자" * 40  # 120자
    with patch("app.services.role_service.call_llm",
               return_value=f'{{"targetRole": "{long_role}"}}'):
        result = extract_target_role("자소서 내용입니다.")
    assert len(result) == 100
    assert result == long_role[:100]
