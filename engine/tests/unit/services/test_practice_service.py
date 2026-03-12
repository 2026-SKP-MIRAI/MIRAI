import json
from unittest.mock import MagicMock, patch
import pytest


def make_mock_llm(content: str):
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=content))
    ]
    return fake


def _single_json(**overrides) -> str:
    base = {
        "score": 75,
        "feedback": {"good": ["좋아요"], "improve": ["개선점"]},
        "keywords": ["STAR"],
        "improvedAnswerGuide": "가이드",
    }
    base.update(overrides)
    return json.dumps(base)


def _retry_json(**overrides) -> str:
    base = {
        "score": 82,
        "feedback": {"good": ["향상됨"], "improve": ["아직 부족"]},
        "keywords": ["STAR", "수치"],
        "improvedAnswerGuide": "더 향상됨",
        "comparisonDelta": {"scoreDelta": 7, "improvements": ["수치 추가"]},
    }
    base.update(overrides)
    return json.dumps(base)


# ── 테스트 1 ──────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_returns_valid_response():
    json_str = _single_json()
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result = generate_practice_feedback("질문", "답변")
    assert result.score is not None
    assert result.feedback is not None
    assert result.keywords is not None
    assert result.improvedAnswerGuide != ""
    assert result.comparisonDelta is None


# ── 테스트 2 ──────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_score_within_range():
    json_str = _single_json()
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result = generate_practice_feedback("질문", "답변")
    assert 0 <= result.score <= 100


# ── 테스트 3 ──────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_comparison_delta_none_without_previous():
    json_str = _single_json()
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result = generate_practice_feedback("질문", "답변", None)
    assert result.comparisonDelta is None


# ── 테스트 4 ──────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_comparison_delta_exists_with_previous():
    json_str = _retry_json()
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result = generate_practice_feedback("질문", "답변", "이전답변")
    assert result.comparisonDelta is not None
    assert isinstance(result.comparisonDelta.scoreDelta, int)


# ── 테스트 5 ──────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_score_clamped_over_100():
    json_str = _single_json(score=105)
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result = generate_practice_feedback("질문", "답변")
    assert result.score == 100


# ── 테스트 6 ──────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_score_clamped_negative():
    json_str = _single_json(score=-5)
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result = generate_practice_feedback("질문", "답변")
    assert result.score == 0


# ── 테스트 7 ──────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_good_truncated_to_3():
    json_str = json.dumps({
        "score": 70,
        "feedback": {"good": ["A", "B", "C", "D"], "improve": ["개선점"]},
        "keywords": ["k"],
        "improvedAnswerGuide": "guide",
    })
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result = generate_practice_feedback("질문", "답변")
    assert len(result.feedback.good) == 3


# ── 테스트 8 ──────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_empty_good_uses_fallback():
    json_str = json.dumps({
        "score": 70,
        "feedback": {"good": [], "improve": ["개선점"]},
        "keywords": ["k"],
        "improvedAnswerGuide": "guide",
    })
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result = generate_practice_feedback("질문", "답변")
    assert result.feedback.good != []
    assert len(result.feedback.good) >= 1


# ── 테스트 9 ──────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_empty_guide_uses_fallback():
    json_str = json.dumps({
        "score": 70,
        "feedback": {"good": ["좋아요"], "improve": ["개선점"]},
        "keywords": ["k"],
        "improvedAnswerGuide": "",
    })
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result = generate_practice_feedback("질문", "답변")
    assert result.improvedAnswerGuide != ""


# ── 테스트 10 ─────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_llm_error_raises_llm_error():
    from app.parsers.exceptions import LLMError
    fake = MagicMock()
    fake.chat.completions.create.side_effect = Exception("API 오류")
    with patch("app.services.llm_client.OpenAI", return_value=fake):
        from app.services.practice_service import generate_practice_feedback
        with pytest.raises(LLMError):
            generate_practice_feedback("질문", "답변")


# ── 테스트 11 ─────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_invalid_json_raises_parse_error():
    from app.parsers.exceptions import PracticeParseError
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm("not json")):
        from app.services.practice_service import generate_practice_feedback
        with pytest.raises(PracticeParseError):
            generate_practice_feedback("질문", "답변")


# ── 테스트 12 ─────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_improve_truncated_to_3():
    json_str = json.dumps({
        "score": 70,
        "feedback": {"good": ["좋아요"], "improve": ["A", "B", "C", "D"]},
        "keywords": ["k"],
        "improvedAnswerGuide": "guide",
    })
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result = generate_practice_feedback("질문", "답변")
    assert len(result.feedback.improve) == 3


# ── 테스트 13 ─────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_keywords_truncated_to_5():
    json_str = json.dumps({
        "score": 70,
        "feedback": {"good": ["좋아요"], "improve": ["개선"]},
        "keywords": ["A", "B", "C", "D", "E", "F"],
        "improvedAnswerGuide": "guide",
    })
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result = generate_practice_feedback("질문", "답변")
    assert len(result.keywords) == 5
