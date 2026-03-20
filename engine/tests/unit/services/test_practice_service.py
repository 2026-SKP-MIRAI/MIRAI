import json
from unittest.mock import MagicMock, patch
import pytest


def make_mock_llm(content: str):
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=content))
    ]
    fake.chat.completions.create.return_value.usage = MagicMock(
        prompt_tokens=10, completion_tokens=5, total_tokens=15
    )
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
        result, _ = generate_practice_feedback("질문", "답변")
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
        result, _ = generate_practice_feedback("질문", "답변")
    assert 0 <= result.score <= 100


# ── 테스트 3 ──────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_comparison_delta_none_without_previous():
    json_str = _single_json()
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result, _ = generate_practice_feedback("질문", "답변", None)
    assert result.comparisonDelta is None


# ── 테스트 4 ──────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_comparison_delta_exists_with_previous():
    json_str = _retry_json()
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result, _ = generate_practice_feedback("질문", "답변", "이전답변")
    assert result.comparisonDelta is not None
    assert isinstance(result.comparisonDelta.scoreDelta, int)


# ── 테스트 5 ──────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_score_clamped_over_100():
    json_str = _single_json(score=105)
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result, _ = generate_practice_feedback("질문", "답변")
    assert result.score == 100


# ── 테스트 6 ──────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_score_clamped_negative():
    json_str = _single_json(score=-5)
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result, _ = generate_practice_feedback("질문", "답변")
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
        result, _ = generate_practice_feedback("질문", "답변")
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
        result, _ = generate_practice_feedback("질문", "답변")
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
        result, _ = generate_practice_feedback("질문", "답변")
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
        result, _ = generate_practice_feedback("질문", "답변")
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
        result, _ = generate_practice_feedback("질문", "답변")
    assert len(result.keywords) == 5


# ── 테스트 14 ─────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_score_delta_overridden_by_previous_score():
    """previousScore 전달 시 scoreDelta = new_score - previous_score (서버 계산)"""
    json_str = json.dumps({
        "score": 88,
        "feedback": {"good": ["향상됨"], "improve": ["아직 부족"]},
        "keywords": ["STAR"],
        "improvedAnswerGuide": "더 향상됨",
        "comparisonDelta": {"scoreDelta": 13, "improvements": ["수치 추가"]},
    })
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result, _ = generate_practice_feedback(
            "질문", "답변", "이전답변",
            previous_score=85,
        )
    assert result.comparisonDelta is not None
    # 88 - 85 = 3, LLM 추정값 13이 아닌 서버 계산값 3이어야 함
    assert result.comparisonDelta.scoreDelta == 3


# ── 테스트 15 ─────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_score_delta_none_without_previous_score():
    """previousAnswer 없으면 comparisonDelta=None, previousScore 있어도 무시"""
    json_str = _single_json()
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result, _ = generate_practice_feedback(
            "질문", "답변",
            previous_score=85,
        )
    assert result.comparisonDelta is None


# ── 테스트 16 ─────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_score_delta_clamped_to_minus100_plus100():
    """scoreDelta 경계값 테스트: previous_score=0, new_score=100 → scoreDelta=100"""
    json_str = json.dumps({
        "score": 100,
        "feedback": {"good": ["완벽"], "improve": ["없음"]},
        "keywords": ["STAR"],
        "improvedAnswerGuide": "완벽한 답변",
        "comparisonDelta": {"scoreDelta": 50, "improvements": []},
    })
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result, _ = generate_practice_feedback(
            "질문", "답변", "이전답변",
            previous_score=0,
        )
    assert result.comparisonDelta is not None
    # 100 - 0 = 100, 경계값 그대로
    assert result.comparisonDelta.scoreDelta == 100
    assert -100 <= result.comparisonDelta.scoreDelta <= 100
