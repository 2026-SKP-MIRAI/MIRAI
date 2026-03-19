import pytest
from unittest.mock import MagicMock, patch
from app.services.llm_service import generate_questions
from app.parsers.exceptions import LLMError

VALID_RESPONSE = '[' + ','.join([
    f'{{"category":"직무 역량","question":"질문{i}?"}}'
    for i in range(8)
]) + ']'

def make_mock_client(response_text: str):
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=response_text))
    ]
    return fake

def test_generate_questions_success():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_client(VALID_RESPONSE)):
        result = generate_questions("이력서 텍스트")
    assert len(result) >= 8
    # TODO: 실제 LLM API를 호출해 질문 품질(구체성, 관련성)을 검증하는 테스트 필요
    #       현재는 형식(JSON 스키마, 개수) 검증만 수행하며 실제 API는 mock으로 대체됨
    #       e2e 또는 별도 평가 스크립트에서 실제 이력서 텍스트로 품질 검증 권장

def test_generate_questions_api_error_raises_llm_error():
    fake = MagicMock()
    fake.chat.completions.create.side_effect = Exception("API 오류")
    with patch("app.services.llm_client.OpenAI", return_value=fake):
        with pytest.raises(LLMError):
            generate_questions("이력서")

def test_generate_questions_invalid_json_raises_llm_error():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_client("not json")):
        with pytest.raises(LLMError):
            generate_questions("이력서")

def test_generate_questions_unknown_category_raises_llm_error():
    bad = '[{"category":"모르는카테고리","question":"질문?"}]' * 8
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_client(bad)):
        with pytest.raises(LLMError):
            generate_questions("이력서")

def test_generate_questions_truncates_long_text():
    long_text = "이력서 " * 10000  # 40,000자 — max_input_chars(16000) 초과
    captured = {}

    def capture_create(**kwargs):
        msg = kwargs.get("messages", [{}])[0]
        captured["content"] = msg.get("content", "")
        return MagicMock(choices=[MagicMock(message=MagicMock(content=VALID_RESPONSE))])

    fake = MagicMock()
    fake.chat.completions.create.side_effect = capture_create

    with patch("app.services.llm_client.OpenAI", return_value=fake):
        generate_questions(long_text, max_input_chars=16000)

    assert len(long_text) > 16000
    # 잘리지 않은 원본 텍스트가 프롬프트에 포함되지 않아야 한다
    assert long_text[:16001] not in captured["content"]


def test_generate_questions_with_target_role_injects_prompt():
    """target_role 전달 시 프롬프트에 직무명이 포함돼야 한다"""
    captured = {}

    def capture_create(**kwargs):
        msg = kwargs.get("messages", [{}])[0]
        captured["content"] = msg.get("content", "")
        return MagicMock(choices=[MagicMock(message=MagicMock(content=VALID_RESPONSE))])

    fake = MagicMock()
    fake.chat.completions.create.side_effect = capture_create

    with patch("app.services.llm_client.OpenAI", return_value=fake):
        generate_questions("이력서 내용", target_role="백엔드 개발자")

    assert "백엔드 개발자" in captured["content"]


def test_generate_questions_without_target_role_no_injection():
    """target_role 미전달 시 프롬프트에 직무 postfix 없음"""
    captured = {}

    def capture_create(**kwargs):
        msg = kwargs.get("messages", [{}])[0]
        captured["content"] = msg.get("content", "")
        return MagicMock(choices=[MagicMock(message=MagicMock(content=VALID_RESPONSE))])

    fake = MagicMock()
    fake.chat.completions.create.side_effect = capture_create

    with patch("app.services.llm_client.OpenAI", return_value=fake):
        generate_questions("이력서 내용")

    assert "지원 직무가" not in captured["content"]
