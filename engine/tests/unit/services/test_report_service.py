import json
import pytest
from unittest.mock import MagicMock, patch
from pydantic import ValidationError


def make_mock_llm(content: str):
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=content))
    ]
    return fake


def make_history(n: int = 5):
    from app.schemas import HistoryItem
    return [
        HistoryItem(
            persona="hr",
            personaLabel="HR 담당자",
            question=f"질문 {i+1}",
            answer=f"답변 {i+1}",
        )
        for i in range(n)
    ]


def _report_json(**overrides) -> str:
    base = {
        "scores": {
            "communication": 80, "problemSolving": 75, "logicalThinking": 70,
            "jobExpertise": 85, "cultureFit": 65, "leadership": 60,
            "creativity": 72, "sincerity": 88,
        },
        "totalScore": 74,
        "summary": "전반적으로 우수한 역량을 보여주었습니다.",
        "axisFeedbacks": [
            {"axis": "communication",   "axisLabel": "의사소통",    "score": 80, "type": "strength",    "feedback": "의사소통 능력이 우수합니다."},
            {"axis": "problemSolving",  "axisLabel": "문제해결",    "score": 75, "type": "strength",    "feedback": "문제해결 능력이 좋습니다."},
            {"axis": "logicalThinking", "axisLabel": "논리적 사고", "score": 70, "type": "improvement", "feedback": "논리적 사고를 더 발전시키세요."},
            {"axis": "jobExpertise",    "axisLabel": "직무 전문성", "score": 85, "type": "strength",    "feedback": "직무 전문성이 뛰어납니다."},
            {"axis": "cultureFit",      "axisLabel": "조직 적합성", "score": 65, "type": "improvement", "feedback": "조직 적합성을 높이세요."},
            {"axis": "leadership",      "axisLabel": "리더십",      "score": 60, "type": "improvement", "feedback": "리더십을 더 키우세요."},
            {"axis": "creativity",      "axisLabel": "창의성",      "score": 72, "type": "improvement", "feedback": "창의성을 발휘하세요."},
            {"axis": "sincerity",       "axisLabel": "성실성",      "score": 88, "type": "strength",    "feedback": "성실성이 매우 뛰어납니다."},
        ],
    }
    base.update(overrides)
    return json.dumps(base)


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
    from app.schemas import ReportResponse
    data = json.loads(_report_json())
    resp = ReportResponse(**data)
    assert hasattr(resp, "scores")
    assert hasattr(resp, "totalScore")
    assert hasattr(resp, "summary")
    assert hasattr(resp, "axisFeedbacks")
    assert resp.growthCurve is None


def test_report_response_axis_feedbacks_count_is_8():
    from app.schemas import ReportResponse
    data = json.loads(_report_json())
    resp = ReportResponse(**data)
    assert len(resp.axisFeedbacks) == 8


# ── 서비스 로직 (14개) ───────────────────────────────────────────────────────

def test_generate_report_returns_valid_response():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(_report_json())):
        from app.services.report_service import generate_report
        result = generate_report("이력서 내용", make_history(5))
    assert result.scores is not None
    assert result.summary != ""
    assert len(result.axisFeedbacks) == 8


def test_generate_report_axes_scores_within_range():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(_report_json())):
        from app.services.report_service import generate_report
        result = generate_report("이력서 내용", make_history(5))
    for field_name in result.scores.__class__.model_fields:
        val = getattr(result.scores, field_name)
        assert 0 <= val <= 100, f"{field_name} 점수 범위 위반: {val}"


def test_generate_report_total_score_within_range():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(_report_json())):
        from app.services.report_service import generate_report
        result = generate_report("이력서 내용", make_history(5))
    assert 0 <= result.totalScore <= 100


def test_generate_report_axis_feedbacks_all_8_axes_present():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(_report_json())):
        from app.services.report_service import generate_report, AXIS_KEYS
        result = generate_report("이력서 내용", make_history(5))
    axes = {fb.axis for fb in result.axisFeedbacks}
    expected = {key for key, _ in AXIS_KEYS}
    assert axes == expected


def test_generate_report_high_score_axis_type_is_strength():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(_report_json())):
        from app.services.report_service import generate_report
        result = generate_report("이력서 내용", make_history(5))
    for fb in result.axisFeedbacks:
        if fb.score >= 75:
            assert fb.type == "strength", f"{fb.axis} score={fb.score} but type={fb.type}"


def test_generate_report_low_score_axis_type_is_improvement():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(_report_json())):
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


# ── 테스트 15 ─────────────────────────────────────────────────────────────────

def test_generate_report_score_over_100_raises_parse_error():
    from app.parsers.exceptions import ReportParseError
    data = json.loads(_report_json())
    data["scores"]["communication"] = 150
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json.dumps(data))):
        from app.services.report_service import generate_report
        with pytest.raises(ReportParseError):
            generate_report("이력서", make_history(5))


# ── 테스트 16 ─────────────────────────────────────────────────────────────────

def test_generate_report_score_negative_raises_parse_error():
    from app.parsers.exceptions import ReportParseError
    data = json.loads(_report_json())
    data["scores"]["communication"] = -10
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json.dumps(data))):
        from app.services.report_service import generate_report
        with pytest.raises(ReportParseError):
            generate_report("이력서", make_history(5))


# ── 테스트 17 ─────────────────────────────────────────────────────────────────

def test_generate_report_missing_scores_raises_parse_error():
    from app.parsers.exceptions import ReportParseError
    data = json.loads(_report_json())
    del data["scores"]
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json.dumps(data))):
        from app.services.report_service import generate_report
        with pytest.raises(ReportParseError):
            generate_report("이력서", make_history(5))


# ── 테스트 18 ─────────────────────────────────────────────────────────────────

def test_generate_report_partial_scores_raises_parse_error():
    from app.parsers.exceptions import ReportParseError
    data = json.loads(_report_json())
    del data["scores"]["communication"]
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json.dumps(data))):
        from app.services.report_service import generate_report
        with pytest.raises(ReportParseError):
            generate_report("이력서", make_history(5))


# ── 테스트 19 ─────────────────────────────────────────────────────────────────

def test_generate_report_null_score_value_raises_parse_error():
    from app.parsers.exceptions import ReportParseError
    data = json.loads(_report_json())
    data["scores"]["communication"] = None
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json.dumps(data))):
        from app.services.report_service import generate_report
        with pytest.raises(ReportParseError):
            generate_report("이력서", make_history(5))


# ── 테스트 20 ─────────────────────────────────────────────────────────────────

def test_generate_report_axis_feedback_score_over_100_raises_parse_error():
    from app.parsers.exceptions import ReportParseError
    data = json.loads(_report_json())
    data["axisFeedbacks"][0]["score"] = 150
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json.dumps(data))):
        from app.services.report_service import generate_report
        with pytest.raises(ReportParseError):
            generate_report("이력서", make_history(5))


# ── 테스트 21 ─────────────────────────────────────────────────────────────────

def test_generate_report_insufficient_answers_raises_error():
    from app.parsers.exceptions import InsufficientAnswersError
    from app.services.report_service import generate_report
    with pytest.raises(InsufficientAnswersError):
        generate_report("이력서", make_history(4))
