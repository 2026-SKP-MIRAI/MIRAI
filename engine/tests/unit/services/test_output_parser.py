import pytest
from app.services.output_parser import parse_llm_response
from app.parsers.exceptions import LLMError

VALID_8 = '[' + ','.join([
    '{"category":"직무 역량","question":"질문입니다?"}',
    '{"category":"경험의 구체성","question":"질문입니다?"}',
    '{"category":"성과 근거","question":"질문입니다?"}',
    '{"category":"기술 역량","question":"질문입니다?"}',
    '{"category":"직무 역량","question":"질문2?"}',
    '{"category":"경험의 구체성","question":"질문2?"}',
    '{"category":"성과 근거","question":"질문2?"}',
    '{"category":"기술 역량","question":"질문2?"}',
]) + ']'

def test_parses_valid_question_array_when_json_matches_schema():
    result = parse_llm_response(VALID_8)
    assert len(result) == 8
    assert all(hasattr(q, 'category') and hasattr(q, 'question') for q in result)

def test_raises_llm_error_when_response_is_not_valid_json():
    with pytest.raises(LLMError):
        parse_llm_response("이건 JSON이 아닙니다")

def test_raises_llm_error_when_root_is_not_list():
    with pytest.raises(LLMError):
        parse_llm_response('{"category": "직무 역량", "question": "질문?"}')

def test_raises_llm_error_when_item_is_not_object():
    with pytest.raises(LLMError):
        parse_llm_response('["문자열", "문자열2"]')

def test_raises_llm_error_when_required_key_category_is_missing():
    with pytest.raises(LLMError):
        parse_llm_response('[{"question":"질문?"}]')

def test_raises_llm_error_when_required_key_question_is_missing():
    with pytest.raises(LLMError):
        parse_llm_response('[{"category":"직무 역량"}]')

def test_raises_llm_error_when_category_is_not_allowed_literal():
    bad = '[' + ','.join(['{"category":"모르는카테고리","question":"질문?"}'] * 8) + ']'
    with pytest.raises(LLMError):
        parse_llm_response(bad)

def test_raises_llm_error_when_question_is_empty_string():
    bad = '[' + ','.join(['{"category":"직무 역량","question":""}'] * 8) + ']'
    with pytest.raises(LLMError):
        parse_llm_response(bad)

def test_raises_llm_error_when_question_count_is_less_than_8():
    seven = '[' + ','.join([
        '{"category":"직무 역량","question":"질문?"}'] * 7) + ']'
    with pytest.raises(LLMError):
        parse_llm_response(seven)

def test_returns_items_when_question_count_is_exactly_8():
    result = parse_llm_response(VALID_8)
    assert len(result) == 8

def test_raises_llm_error_when_question_count_is_zero():
    with pytest.raises(LLMError):
        parse_llm_response('[]')
