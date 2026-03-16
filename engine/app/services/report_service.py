import json
from pathlib import Path
from app.parsers.exceptions import LLMError, InsufficientAnswersError, ReportParseError
from app.schemas import HistoryItem, ReportResponse, AxisScores, AxisFeedback
from app.services.llm_client import call_llm as _call_llm, strip_code_block as _strip_code_block

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


def _validate_score(key: str, val: int | None) -> int:
    if not isinstance(val, int) or not (0 <= val <= 100):
        raise ReportParseError(f"scores.{key} 값이 유효하지 않음: {val}")
    return val


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

    # scores 파싱 — 8개 키 전부 있어야 하며 null 값도 불허
    raw_scores = data.get("scores", {}) if isinstance(data.get("scores"), dict) else {}
    missing = [key for key, _ in AXIS_KEYS if key not in raw_scores or raw_scores[key] is None]
    if missing:
        raise ReportParseError(f"scores 키 누락 또는 null: {missing}")
    score_values = {key: _validate_score(key, raw_scores[key]) for key, _ in AXIS_KEYS}
    scores = AxisScores(**score_values)

    # totalScore = 8개 평균 (정수 반올림) — 검증된 점수의 평균이므로 항상 0~100
    total_score = round(sum(score_values.values()) / len(AXIS_KEYS))

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
        score = _validate_score(axis, fb.get("score"))
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


def generate_report(
    resumeText: str,
    history: list[HistoryItem],
    *,
    model: str | None = None,
) -> ReportResponse:
    if len(history) < MIN_ANSWERS:
        raise InsufficientAnswersError(
            f"최소 {MIN_ANSWERS}개 답변이 필요합니다. 현재 {len(history)}개입니다."
        )
    prompt = _build_prompt(resumeText, history)
    raw = _call_llm(prompt, model=model, timeout=60.0, max_tokens=2048,
                    error_message="리포트 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.")
    return _parse_report(raw)
