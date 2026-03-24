import json
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
from pydantic import ValidationError

FIXTURES_OUTPUT = Path(__file__).parent.parent.parent / "fixtures/output"

MOCK_REPORT_JSON = (FIXTURES_OUTPUT / "mock_report_response.json").read_text(encoding="utf-8")
MOCK_HISTORY = json.loads((FIXTURES_OUTPUT / "mock_history_5items.json").read_text(encoding="utf-8"))

# v2: LLM은 피드백 텍스트만 반환 (점수 없음)
MOCK_V2_FEEDBACK_JSON = json.dumps({
    "summary": "지원자는 전반적으로 우수한 역량을 보여주었습니다.",
    "axisFeedbacks": [
        {"axis": "communication",   "axisLabel": "의사소통",    "feedback": "명확한 구조로 의사소통 능력을 잘 보여주었습니다."},
        {"axis": "leadership",      "axisLabel": "리더십",      "feedback": "주도적 행동 표현을 더 부각해 주세요."},
        {"axis": "problemSolving",  "axisLabel": "문제해결",    "feedback": "원인 분석과 대안 검토를 더 구체적으로 제시해 주세요."},
        {"axis": "logicalThinking", "axisLabel": "논리적 사고", "feedback": "논리적 인과관계가 잘 드러났습니다."},
        {"axis": "jobExpertise",    "axisLabel": "직무 전문성", "feedback": "수치 기반 성과로 전문성을 잘 보여주었습니다."},
        {"axis": "cultureFit",      "axisLabel": "조직 적합성", "feedback": "협업 태도가 잘 드러났습니다."},
        {"axis": "creativity",      "axisLabel": "창의성",      "feedback": "다양한 대안을 검토한 경험을 제시해 주세요."},
        {"axis": "sincerity",       "axisLabel": "성실성",      "feedback": "충분한 분량으로 성실성이 잘 드러났습니다."},
    ],
}, ensure_ascii=False)


def make_mock_llm(content: str):
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=content))
    ]
    fake.chat.completions.create.return_value.usage = MagicMock(
        prompt_tokens=10, completion_tokens=5, total_tokens=15
    )
    return fake


def make_history(n: int = 5):
    from app.schemas import HistoryItem
    return [HistoryItem(**item) for item in MOCK_HISTORY[:n]]


# ── 스키마 유효성 ─────────────────────────────────────────────────────────────

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


def test_axis_scores_accepts_none():
    """not_evaluated 시 score는 None 허용."""
    from app.schemas import AxisScores
    scores = AxisScores(communication=None, problemSolving=80)
    assert scores.communication is None
    assert scores.problemSolving == 80


def test_axis_feedback_accepts_not_evaluated_type():
    from app.schemas import AxisFeedback
    fb = AxisFeedback(
        axis="leadership", axisLabel="리더십",
        score=None, type="not_evaluated",
        feedback="해당 역량을 평가할 수 있는 답변이 충분하지 않습니다.",
    )
    assert fb.type == "not_evaluated"
    assert fb.score is None


# ── 서비스 로직 (v2 루브릭 기반) ──────────────────────────────────────────────

def test_generate_report_returns_valid_response():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_V2_FEEDBACK_JSON)):
        from app.services.report_service import generate_report
        result, _ = generate_report("이력서 내용", make_history(5))
    assert result.scores is not None
    assert result.summary != ""
    assert len(result.axisFeedbacks) == 8


def test_generate_report_axes_scores_within_range():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_V2_FEEDBACK_JSON)):
        from app.services.report_service import generate_report
        result, _ = generate_report("이력서 내용", make_history(5))
    for field_name in result.scores.model_fields:
        val = getattr(result.scores, field_name)
        assert val is None or 0 <= val <= 100, f"{field_name} 점수 범위 위반: {val}"


def test_generate_report_total_score_within_range():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_V2_FEEDBACK_JSON)):
        from app.services.report_service import generate_report
        result, _ = generate_report("이력서 내용", make_history(5))
    assert 0 <= result.totalScore <= 100


def test_generate_report_all_8_axes_present():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_V2_FEEDBACK_JSON)):
        from app.services.report_service import generate_report, AXIS_KEYS
        result, _ = generate_report("이력서 내용", make_history(5))
    axes = {fb.axis for fb in result.axisFeedbacks}
    expected = {key for key, _ in AXIS_KEYS}
    assert axes == expected


def test_generate_report_strength_type_when_score_high():
    """score >= 75이면 type="strength"."""
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_V2_FEEDBACK_JSON)):
        from app.services.report_service import generate_report
        result, _ = generate_report("이력서 내용", make_history(5))
    for fb in result.axisFeedbacks:
        if fb.score is not None and fb.score >= 75:
            assert fb.type == "strength", f"{fb.axis} score={fb.score} but type={fb.type}"


def test_generate_report_improvement_type_when_score_low():
    """score < 75이면 type="improvement"."""
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_V2_FEEDBACK_JSON)):
        from app.services.report_service import generate_report
        result, _ = generate_report("이력서 내용", make_history(5))
    for fb in result.axisFeedbacks:
        if fb.score is not None and fb.score < 75:
            assert fb.type == "improvement", f"{fb.axis} score={fb.score} but type={fb.type}"


def test_generate_report_llm_api_error_raises_llm_error():
    from app.parsers.exceptions import LLMError
    fake = MagicMock()
    fake.chat.completions.create.side_effect = Exception("API 오류")
    with patch("app.services.llm_client.OpenAI", return_value=fake):
        from app.services.report_service import generate_report
        with pytest.raises(LLMError):
            generate_report("이력서", make_history(5))


def test_generate_report_invalid_json_raises_error():
    from app.parsers.exceptions import LLMError
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm("not valid json")):
        from app.services.report_service import generate_report
        with pytest.raises(LLMError):
            generate_report("이력서", make_history(5))


def test_generate_report_insufficient_answers_raises_error():
    from app.parsers.exceptions import InsufficientAnswersError
    from app.services.report_service import generate_report
    with pytest.raises(InsufficientAnswersError):
        generate_report("이력서", make_history(4))


# ── not_evaluated 분기 ────────────────────────────────────────────────────────

def _make_empty_history(n: int = 5):
    """모든 답변이 빈 문자열인 히스토리."""
    from app.schemas import HistoryItem
    return [
        HistoryItem(
            persona="hr", personaLabel="HR 담당자",
            question=f"질문{i}", answer="",
        )
        for i in range(n)
    ]


def test_generate_report_not_evaluated_when_all_answers_empty():
    """모든 답변이 비어 있으면 전 축이 not_evaluated."""
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_V2_FEEDBACK_JSON)):
        from app.services.report_service import generate_report
        result, _ = generate_report("이력서", _make_empty_history(5))
    for fb in result.axisFeedbacks:
        assert fb.type == "not_evaluated", f"{fb.axis} should be not_evaluated"
        assert fb.score is None


def test_generate_report_not_evaluated_excluded_from_total_score():
    """not_evaluated 축은 totalScore 계산에서 제외된다."""
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_V2_FEEDBACK_JSON)):
        from app.services.report_service import generate_report
        result, _ = generate_report("이력서", _make_empty_history(5))
    # 모두 not_evaluated이면 totalScore = 0
    assert result.totalScore == 0


def test_generate_report_signals_field_included_when_has_content():
    """has_content=True인 경우 응답 최상위 signals 필드가 포함된다."""
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_V2_FEEDBACK_JSON)):
        from app.services.report_service import generate_report
        result, _ = generate_report("이력서 내용", make_history(5))
    assert result.signals is not None
    assert "star_score" in result.signals
    assert "specificity_score" in result.signals


def test_generate_report_rubric_scores_are_deterministic():
    """동일 입력에 대해 규칙 기반 점수는 항상 동일하다."""
    history = make_history(5)
    scores_runs = []
    for _ in range(3):
        with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_V2_FEEDBACK_JSON)):
            from app.services.report_service import generate_report
            result, _ = generate_report("이력서", history)
        scores_runs.append({fb.axis: fb.score for fb in result.axisFeedbacks})
    assert scores_runs[0] == scores_runs[1] == scores_runs[2]
