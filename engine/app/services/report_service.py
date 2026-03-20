import json
from pathlib import Path
from app.parsers.exceptions import LLMError, InsufficientAnswersError, ReportParseError
from app.schemas import HistoryItem, ReportResponse, AxisScores, AxisFeedback, UsageMetadata
from app.services.llm_client import call_llm as _call_llm, strip_code_block as _strip_code_block, UsageInfo

PROMPT_DIR = Path(__file__).parent.parent / "prompts"

MIN_ANSWERS = 5
AXIS_KEYS = [
    ("communication",   "의사소통"),
    ("problemSolving",  "문제해결"),
    ("logicalThinking", "논리적 사고"),
    ("jobExpertise",    "직무 전문성"),
    ("cultureFit",      "조직 적합성"),
    ("leadership",      "리더십"),
    ("creativity",      "창의성"),
    ("sincerity",       "성실성"),
]


def _clamp(val) -> int:
    try:
        return max(0, min(100, int(val)))
    except (TypeError, ValueError):
        return 50


def _build_prompt(resume_text: str, history: list[HistoryItem]) -> str:
    prompt_template = (PROMPT_DIR / "report_evaluation_v1.md").read_text(encoding="utf-8")
    history_lines = []
    for i, item in enumerate(history, 1):
        history_lines.append(f"[{i}] {item.personaLabel} ({item.persona})")
        history_lines.append(f"Q: {item.question}")
        history_lines.append(f"A: {item.answer}")
        history_lines.append("")
    history_text = "\n".join(history_lines)
    return (
        prompt_template
        .replace("{resume_text}", resume_text[:16000])
        .replace("{history_text}", history_text)
    )


def _parse_report(raw: str) -> ReportResponse:
    try:
        s = _strip_code_block(raw)
        data = json.loads(s)
    except json.JSONDecodeError as e:
        raise ReportParseError(f"리포트 JSON 파싱 실패: {e}") from e

    if not isinstance(data, dict):
        raise ReportParseError("리포트 응답이 객체가 아닙니다")

    # scores 파싱 (축 누락 시 50점 fallback)
    raw_scores = data.get("scores", {}) if isinstance(data.get("scores"), dict) else {}
    score_values = {key: _clamp(raw_scores.get(key, 50)) for key, _ in AXIS_KEYS}
    scores = AxisScores(**score_values)

    # totalScore = 8개 평균 (정수 반올림)
    total_score = round(sum(score_values.values()) / len(AXIS_KEYS))
    total_score = _clamp(total_score)

    summary = str(data.get("summary", ""))

    # axisFeedbacks 파싱
    raw_feedbacks = data.get("axisFeedbacks", [])
    if not isinstance(raw_feedbacks, list) or len(raw_feedbacks) != 8:
        raise ReportParseError(
            f"axisFeedbacks는 정확히 8개여야 합니다. 현재 {len(raw_feedbacks) if isinstance(raw_feedbacks, list) else 0}개."
        )

    axis_feedbacks = []
    for fb in raw_feedbacks:
        axis = str(fb.get("axis", ""))
        axis_label = str(fb.get("axisLabel", ""))
        score = _clamp(fb.get("score", 50))
        # type 강제 보정: score >= 75이면 strength, 미만이면 improvement
        fb_type = "strength" if score >= 75 else "improvement"
        feedback = str(fb.get("feedback", ""))
        axis_feedbacks.append(AxisFeedback(
            axis=axis,
            axisLabel=axis_label,
            score=score,
            type=fb_type,
            feedback=feedback,
        ))

    return ReportResponse(
        scores=scores,
        totalScore=total_score,
        summary=summary,
        axisFeedbacks=axis_feedbacks,
        growthCurve=None,
    )


def _usage_to_metadata(usage: UsageInfo | None, model: str) -> UsageMetadata | None:
    if usage is None:
        return None
    return UsageMetadata(
        prompt_tokens=usage.prompt_tokens,
        completion_tokens=usage.completion_tokens,
        total_tokens=usage.total_tokens,
        model=model,
    )


def generate_report(
    resumeText: str,
    history: list[HistoryItem],
    *,
    model: str | None = None,
) -> tuple[ReportResponse, UsageMetadata | None]:
    if len(history) < MIN_ANSWERS:
        raise InsufficientAnswersError(
            f"최소 {MIN_ANSWERS}개 답변이 필요합니다. 현재 {len(history)}개입니다."
        )
    prompt = _build_prompt(resumeText, history)
    result = _call_llm(prompt, model=model, timeout=60.0, max_tokens=2048,
                       error_message="리포트 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.")
    return _parse_report(result.content), _usage_to_metadata(result.usage, result.model)
