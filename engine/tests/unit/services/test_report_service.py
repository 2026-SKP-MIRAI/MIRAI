import json
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
from pydantic import ValidationError

FIXTURES_OUTPUT = Path(__file__).parent.parent.parent / "fixtures/output"

MOCK_REPORT_JSON = (FIXTURES_OUTPUT / "mock_report_response.json").read_text(encoding="utf-8")
MOCK_HISTORY = json.loads((FIXTURES_OUTPUT / "mock_history_5items.json").read_text(encoding="utf-8"))


def make_mock_llm(content: str):
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=content))
    ]
    return fake


def make_history(n: int = 5):
    from app.schemas import HistoryItem
    return [
        HistoryItem(**item) for item in MOCK_HISTORY[:n]
    ]


# ── 스키마 유효성 (6개) ────────────────────────────────────────────────────────

def test_report_request_valid():
    from app.schemas import ReportRequest
    req = ReportRequest(resumeText="이력서 내용", history=make_history(5))
    assert req.resumeText == "이력서 내용"
    assert len(req.history) == 5


def test_report_request_history_too_short_raises_validation_error():
    from app.schemas import ReportRequest
    with pytest.raises(ValidationError):
        ReportRequest(resumeText="이력서", history=[])


def test_report_request_history_exactly_5_is_valid():
    from app.schemas import ReportRequest
    req = ReportRequest(resumeText="이력서", history=make_history(5))
    assert len(req.history) == 5


def test_report_request_empty_resume_raises_validation_error():
    from app.schemas import ReportRequest
    with pytest.raises(ValidationError):
        ReportRequest(resumeText="", history=make_history(5))


def test_report_response_has_required_fields():
    from app.schemas import ReportResponse, AxisScores, AxisFeedback
    data = json.loads(MOCK_REPORT_JSON)
    resp = ReportResponse(**data)
    assert hasattr(resp, "scores")
    assert hasattr(resp, "totalScore")
    assert hasattr(resp, "summary")
    assert hasattr(resp, "axisFeedbacks")
    assert resp.growthCurve is None


def test_report_response_axis_feedbacks_count_is_8():
    from app.schemas import ReportResponse
    data = json.loads(MOCK_REPORT_JSON)
    resp = ReportResponse(**data)
    assert len(resp.axisFeedbacks) == 8


# ── 서비스 로직 (10개) ───────────────────────────────────────────────────────

def test_generate_report_returns_valid_response():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_REPORT_JSON)):
        from app.services.report_service import generate_report
        result = generate_report("이력서 내용", make_history(5))
    assert result.scores is not None
    assert result.summary != ""
    assert len(result.axisFeedbacks) == 8


def test_generate_report_axes_scores_within_range():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_REPORT_JSON)):
        from app.services.report_service import generate_report
        result = generate_report("이력서 내용", make_history(5))
    for field_name in result.scores.model_fields:
        val = getattr(result.scores, field_name)
        assert 0 <= val <= 100, f"{field_name} 점수 범위 위반: {val}"


def test_generate_report_total_score_within_range():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_REPORT_JSON)):
        from app.services.report_service import generate_report
        result = generate_report("이력서 내용", make_history(5))
    assert 0 <= result.totalScore <= 100


def test_generate_report_axis_feedbacks_all_8_axes_present():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_REPORT_JSON)):
        from app.services.report_service import generate_report, AXIS_KEYS
        result = generate_report("이력서 내용", make_history(5))
    axes = {fb.axis for fb in result.axisFeedbacks}
    expected = {key for key, _ in AXIS_KEYS}
    assert axes == expected


def test_generate_report_high_score_axis_type_is_strength():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_REPORT_JSON)):
        from app.services.report_service import generate_report
        result = generate_report("이력서 내용", make_history(5))
    for fb in result.axisFeedbacks:
        if fb.score >= 75:
            assert fb.type == "strength", f"{fb.axis} score={fb.score} but type={fb.type}"


def test_generate_report_low_score_axis_type_is_improvement():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_REPORT_JSON)):
        from app.services.report_service import generate_report
        result = generate_report("이력서 내용", make_history(5))
    for fb in result.axisFeedbacks:
        if fb.score < 75:
            assert fb.type == "improvement", f"{fb.axis} score={fb.score} but type={fb.type}"


def test_generate_report_llm_api_error_raises_llm_error():
    from app.parsers.exceptions import LLMError
    fake = MagicMock()
    fake.chat.completions.create.side_effect = Exception("API 오류")
    with patch("app.services.llm_client.OpenAI", return_value=fake):
        from app.services.report_service import generate_report
        with pytest.raises(LLMError):
            generate_report("이력서", make_history(5))


def test_generate_report_invalid_json_raises_llm_error():
    from app.parsers.exceptions import LLMError
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm("not valid json")):
        from app.services.report_service import generate_report
        with pytest.raises(LLMError):
            generate_report("이력서", make_history(5))


def test_generate_report_score_clamped_when_out_of_range():
    out_of_range = json.loads(MOCK_REPORT_JSON)
    out_of_range["scores"]["communication"] = 150
    out_of_range["scores"]["problemSolving"] = -10
    # axisFeedbacks도 수정
    for fb in out_of_range["axisFeedbacks"]:
        if fb["axis"] == "communication":
            fb["score"] = 150
        if fb["axis"] == "problemSolving":
            fb["score"] = -10
    raw = json.dumps(out_of_range)
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(raw)):
        from app.services.report_service import generate_report
        result = generate_report("이력서", make_history(5))
    assert result.scores.communication == 100
    assert result.scores.problemSolving == 0


def test_generate_report_insufficient_answers_raises_error():
    from app.parsers.exceptions import InsufficientAnswersError
    from app.services.report_service import generate_report
    with pytest.raises(InsufficientAnswersError):
        generate_report("이력서", make_history(4))
