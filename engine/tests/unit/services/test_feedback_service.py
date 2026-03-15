import json
from unittest.mock import MagicMock, patch
import pytest


def make_mock_llm(content: str):
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=content))
    ]
    return fake


def _feedback_json(**overrides) -> str:
    base = {
        "scores": {
            "specificity": 72, "achievementClarity": 65,
            "logicStructure": 80, "roleAlignment": 88, "differentiation": 60,
        },
        "strengths": ["직무 연관성 명확", "논리 구조 우수"],
        "weaknesses": ["수치 근거 부족", "차별화 요소 약함"],
        "suggestions": [
            {"section": "성장 경험", "issue": "수치 없음", "suggestion": "30% 개선 등 수치 추가"}
        ],
    }
    base.update(overrides)
    return json.dumps(base)


# ── 테스트 1 ──────────────────────────────────────────────────────────────────

def test_generate_resume_feedback_returns_valid_response():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(_feedback_json())):
        from app.services.feedback_service import generate_resume_feedback
        result = generate_resume_feedback("자소서 내용", "백엔드 개발자")
    assert result.scores is not None
    assert result.strengths is not None
    assert result.weaknesses is not None
    assert result.suggestions is not None


# ── 테스트 2 ──────────────────────────────────────────────────────────────────

def test_generate_resume_feedback_scores_within_range():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(_feedback_json())):
        from app.services.feedback_service import generate_resume_feedback
        result = generate_resume_feedback("자소서 내용", "백엔드 개발자")
    assert 0 <= result.scores.specificity <= 100
    assert 0 <= result.scores.achievementClarity <= 100
    assert 0 <= result.scores.logicStructure <= 100
    assert 0 <= result.scores.roleAlignment <= 100
    assert 0 <= result.scores.differentiation <= 100


# ── 테스트 3 ──────────────────────────────────────────────────────────────────

def test_generate_resume_feedback_strengths_count():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(_feedback_json())):
        from app.services.feedback_service import generate_resume_feedback
        result = generate_resume_feedback("자소서 내용", "백엔드 개발자")
    assert 2 <= len(result.strengths) <= 3


# ── 테스트 4 ──────────────────────────────────────────────────────────────────

def test_generate_resume_feedback_weaknesses_count():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(_feedback_json())):
        from app.services.feedback_service import generate_resume_feedback
        result = generate_resume_feedback("자소서 내용", "백엔드 개발자")
    assert 2 <= len(result.weaknesses) <= 3


# ── 테스트 5 ──────────────────────────────────────────────────────────────────

def test_generate_resume_feedback_suggestions_structure():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(_feedback_json())):
        from app.services.feedback_service import generate_resume_feedback
        result = generate_resume_feedback("자소서 내용", "백엔드 개발자")
    assert len(result.suggestions) >= 1
    sug = result.suggestions[0]
    assert hasattr(sug, "section")
    assert hasattr(sug, "issue")
    assert hasattr(sug, "suggestion")


# ── 테스트 6 ──────────────────────────────────────────────────────────────────

def test_generate_resume_feedback_score_clamped_over_100():
    json_str = json.dumps({
        "scores": {"specificity": 105, "achievementClarity": 65,
                   "logicStructure": 80, "roleAlignment": 88, "differentiation": 60},
        "strengths": ["강점1", "강점2"],
        "weaknesses": ["약점1", "약점2"],
        "suggestions": [{"section": "s", "issue": "i", "suggestion": "su"}],
    })
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.feedback_service import generate_resume_feedback
        result = generate_resume_feedback("자소서 내용", "백엔드 개발자")
    assert result.scores.specificity == 100


# ── 테스트 7 ──────────────────────────────────────────────────────────────────

def test_generate_resume_feedback_score_clamped_negative():
    json_str = json.dumps({
        "scores": {"specificity": -5, "achievementClarity": 65,
                   "logicStructure": 80, "roleAlignment": 88, "differentiation": 60},
        "strengths": ["강점1", "강점2"],
        "weaknesses": ["약점1", "약점2"],
        "suggestions": [{"section": "s", "issue": "i", "suggestion": "su"}],
    })
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.feedback_service import generate_resume_feedback
        result = generate_resume_feedback("자소서 내용", "백엔드 개발자")
    assert result.scores.specificity == 0


# ── 테스트 8 ──────────────────────────────────────────────────────────────────

def test_generate_resume_feedback_strengths_truncated_to_3():
    with patch("app.services.llm_client.OpenAI",
               return_value=make_mock_llm(_feedback_json(strengths=["A", "B", "C", "D"]))):
        from app.services.feedback_service import generate_resume_feedback
        result = generate_resume_feedback("자소서 내용", "백엔드 개발자")
    assert len(result.strengths) == 3


# ── 테스트 9 ──────────────────────────────────────────────────────────────────

def test_generate_resume_feedback_weaknesses_truncated_to_3():
    with patch("app.services.llm_client.OpenAI",
               return_value=make_mock_llm(_feedback_json(weaknesses=["A", "B", "C", "D"]))):
        from app.services.feedback_service import generate_resume_feedback
        result = generate_resume_feedback("자소서 내용", "백엔드 개발자")
    assert len(result.weaknesses) == 3


# ── 테스트 10 ─────────────────────────────────────────────────────────────────

def test_generate_resume_feedback_empty_strengths_uses_fallback():
    with patch("app.services.llm_client.OpenAI",
               return_value=make_mock_llm(_feedback_json(strengths=[]))):
        from app.services.feedback_service import generate_resume_feedback
        result = generate_resume_feedback("자소서 내용", "백엔드 개발자")
    assert len(result.strengths) >= 2


# ── 테스트 11 ─────────────────────────────────────────────────────────────────

def test_generate_resume_feedback_llm_error_raises_llm_error():
    from app.parsers.exceptions import LLMError
    fake = MagicMock()
    fake.chat.completions.create.side_effect = Exception("API 오류")
    with patch("app.services.llm_client.OpenAI", return_value=fake):
        from app.services.feedback_service import generate_resume_feedback
        with pytest.raises(LLMError):
            generate_resume_feedback("자소서 내용", "백엔드 개발자")


# ── 테스트 12 ─────────────────────────────────────────────────────────────────

def test_generate_resume_feedback_invalid_json_raises_parse_error():
    from app.parsers.exceptions import ResumeFeedbackParseError
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm("not json")):
        from app.services.feedback_service import generate_resume_feedback
        with pytest.raises(ResumeFeedbackParseError):
            generate_resume_feedback("자소서 내용", "백엔드 개발자")


# ── 테스트 13 ─────────────────────────────────────────────────────────────────

def test_generate_resume_feedback_missing_scores_raises_parse_error():
    from app.parsers.exceptions import ResumeFeedbackParseError
    json_str = json.dumps({
        "strengths": ["강점1", "강점2"],
        "weaknesses": ["약점1", "약점2"],
        "suggestions": [{"section": "s", "issue": "i", "suggestion": "su"}],
    })
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.feedback_service import generate_resume_feedback
        with pytest.raises(ResumeFeedbackParseError):
            generate_resume_feedback("자소서 내용", "백엔드 개발자")


# ── 테스트 14 ─────────────────────────────────────────────────────────────────

def test_generate_resume_feedback_partial_scores_raises_parse_error():
    from app.parsers.exceptions import ResumeFeedbackParseError
    json_str = json.dumps({
        "scores": {"specificity": 72, "achievementClarity": 65,
                   "logicStructure": 80, "roleAlignment": 88},
        "strengths": ["강점1", "강점2"],
        "weaknesses": ["약점1", "약점2"],
        "suggestions": [{"section": "s", "issue": "i", "suggestion": "su"}],
    })
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.feedback_service import generate_resume_feedback
        with pytest.raises(ResumeFeedbackParseError):
            generate_resume_feedback("자소서 내용", "백엔드 개발자")


# ── 테스트 15 ─────────────────────────────────────────────────────────────────

def test_generate_resume_feedback_null_score_value_raises_parse_error():
    from app.parsers.exceptions import ResumeFeedbackParseError
    json_str = json.dumps({
        "scores": {"specificity": None, "achievementClarity": 65,
                   "logicStructure": 80, "roleAlignment": 88, "differentiation": 60},
        "strengths": ["강점1", "강점2"],
        "weaknesses": ["약점1", "약점2"],
        "suggestions": [{"section": "s", "issue": "i", "suggestion": "su"}],
    })
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.feedback_service import generate_resume_feedback
        with pytest.raises(ResumeFeedbackParseError):
            generate_resume_feedback("자소서 내용", "백엔드 개발자")
