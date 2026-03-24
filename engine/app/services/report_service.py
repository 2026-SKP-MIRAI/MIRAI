import dataclasses
import json
from pathlib import Path

from app.analyzers import analyze, TextSignals
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


# ── 신호 집계 ─────────────────────────────────────────────────────────────────

def _aggregate_signals(signals_list: list[TextSignals]) -> TextSignals:
    """여러 답변의 TextSignals를 하나로 집계한다.

    - float 신호(구체성·성과·STAR): 각 답변 중 최댓값 (최고 답변 기준)
    - vague_ratio: 평균 (전체적인 모호성 수준)
    - int 신호(카운트): 합산 (전체 답변 누적)
    - answer_length: 평균
    - has_content: 하나라도 유효 답변이 있으면 True
    """
    non_empty = [s for s in signals_list if s.has_content]
    if not non_empty:
        return TextSignals(
            specificity_score=0.0,
            achievement_score=0.0,
            star_score=0.0,
            vague_ratio=0.0,
            agency_verb_count=0,
            cause_analysis_count=0,
            alternative_count=0,
            has_content=False,
            answer_length=0,
        )
    n = len(non_empty)
    return TextSignals(
        specificity_score=max(s.specificity_score for s in non_empty),
        achievement_score=max(s.achievement_score for s in non_empty),
        star_score=max(s.star_score for s in non_empty),
        vague_ratio=sum(s.vague_ratio for s in non_empty) / n,
        agency_verb_count=sum(s.agency_verb_count for s in non_empty),
        cause_analysis_count=sum(s.cause_analysis_count for s in non_empty),
        alternative_count=sum(s.alternative_count for s in non_empty),
        has_content=True,
        answer_length=round(sum(s.answer_length for s in non_empty) / n),
    )


# ── 8축 루브릭 함수 ───────────────────────────────────────────────────────────

def _score_communication(s: TextSignals) -> tuple[int | None, str]:
    if not s.has_content:
        return None, "not_evaluated"
    base = s.star_score * 60 + (1 - s.vague_ratio) * 40
    if s.answer_length < 100:
        base -= max(0, (100 - s.answer_length) / 100 * 15)
    score = _clamp(round(base))
    return score, "strength" if score >= 75 else "improvement"


def _score_leadership(s: TextSignals) -> tuple[int | None, str]:
    if not s.has_content:
        return None, "not_evaluated"
    base = min(s.agency_verb_count, 5) / 5 * 70 + s.specificity_score * 30
    score = _clamp(round(base))
    return score, "strength" if score >= 75 else "improvement"


def _score_problem_solving(s: TextSignals) -> tuple[int | None, str]:
    if not s.has_content:
        return None, "not_evaluated"
    cause_part = min(s.cause_analysis_count, 3) / 3 * 35
    alt_part = min(s.alternative_count, 3) / 3 * 35
    star_part = s.star_score * 30
    score = _clamp(round(cause_part + alt_part + star_part))
    return score, "strength" if score >= 75 else "improvement"


def _score_logical_thinking(s: TextSignals) -> tuple[int | None, str]:
    if not s.has_content:
        return None, "not_evaluated"
    star_part = s.star_score * 50
    cause_part = min(s.cause_analysis_count, 4) / 4 * 40
    vague_penalty = max(0, (s.vague_ratio - 0.2) * 50) if s.vague_ratio > 0.2 else 0
    score = _clamp(round(star_part + cause_part + 10 - vague_penalty))
    return score, "strength" if score >= 75 else "improvement"


def _score_job_expertise(s: TextSignals) -> tuple[int | None, str]:
    if not s.has_content:
        return None, "not_evaluated"
    score = _clamp(round(s.specificity_score * 50 + s.achievement_score * 40 + 10))
    return score, "strength" if score >= 75 else "improvement"


def _score_culture_fit(s: TextSignals) -> tuple[int | None, str]:
    if not s.has_content:
        return None, "not_evaluated"
    agency_part = min(s.agency_verb_count, 4) / 4 * 40
    clarity_part = (1 - s.vague_ratio) * 30
    star_part = s.star_score * 20
    score = _clamp(round(agency_part + clarity_part + star_part + 10))
    return score, "strength" if score >= 75 else "improvement"


def _score_creativity(s: TextSignals) -> tuple[int | None, str]:
    if not s.has_content:
        return None, "not_evaluated"
    alt_part = min(s.alternative_count, 4) / 4 * 50
    ach_part = s.achievement_score * 30
    spec_bonus = s.specificity_score * 10
    score = _clamp(round(alt_part + ach_part + spec_bonus + 10))
    return score, "strength" if score >= 75 else "improvement"


def _score_sincerity(s: TextSignals) -> tuple[int | None, str]:
    if not s.has_content:
        return None, "not_evaluated"
    star_part = s.star_score * 40
    length_part = min(s.answer_length, 300) / 300 * 35
    clarity_part = (1 - s.vague_ratio) * 15
    score = _clamp(round(star_part + length_part + clarity_part + 10))
    return score, "strength" if score >= 75 else "improvement"


_RUBRIC_FUNCS: dict = {
    "communication":   _score_communication,
    "leadership":      _score_leadership,
    "problemSolving":  _score_problem_solving,
    "logicalThinking": _score_logical_thinking,
    "jobExpertise":    _score_job_expertise,
    "cultureFit":      _score_culture_fit,
    "creativity":      _score_creativity,
    "sincerity":       _score_sincerity,
}


def _apply_rubric(signals: TextSignals) -> dict[str, tuple[int | None, str]]:
    """8축 루브릭 적용. {axis: (score, type)} 반환 (결정론적)."""
    return {key: func(signals) for key, func in _RUBRIC_FUNCS.items()}


# ── 프롬프트 빌더 ──────────────────────────────────────────────────────────────

def _format_history(history: list[HistoryItem]) -> str:
    lines = []
    for i, item in enumerate(history, 1):
        lines.append(f"[{i}] {item.personaLabel} ({item.persona})")
        lines.append(f"Q: {item.question}")
        lines.append(f"A: {item.answer}")
        lines.append("")
    return "\n".join(lines)


def _build_prompt_v2(
    resume_text: str,
    history: list[HistoryItem],
    rubric_results: dict[str, tuple[int | None, str]],
) -> str:
    """v2 프롬프트: 규칙 기반 점수 컨텍스트 포함. LLM은 피드백 텍스트만 생성."""
    prompt_template = (PROMPT_DIR / "report_evaluation_v2.md").read_text(encoding="utf-8")
    scores_context = json.dumps(
        {key: {"score": score, "type": fb_type} for key, (score, fb_type) in rubric_results.items()},
        ensure_ascii=False,
    )
    return (
        prompt_template
        .replace("{resume_text}", resume_text[:16000])
        .replace("{history_text}", _format_history(history))
        .replace("{scores_context}", scores_context)
    )


# ── 파서 ─────────────────────────────────────────────────────────────────────

def _parse_report_v2(
    raw: str,
    rubric_results: dict[str, tuple[int | None, str]],
    combined: TextSignals,
) -> ReportResponse:
    """v2 LLM 응답(피드백 텍스트만) + 규칙 기반 점수를 조합하여 ReportResponse를 생성."""
    try:
        s = _strip_code_block(raw)
        data = json.loads(s)
    except json.JSONDecodeError as e:
        raise ReportParseError(f"리포트 JSON 파싱 실패: {e}") from e

    if not isinstance(data, dict):
        raise ReportParseError("리포트 응답이 객체가 아닙니다")

    # 피드백 텍스트 맵 (axis → {axisLabel, feedback})
    raw_feedbacks = data.get("axisFeedbacks", [])
    feedback_map: dict[str, dict] = {}
    if isinstance(raw_feedbacks, list):
        for fb in raw_feedbacks:
            if isinstance(fb, dict) and fb.get("axis"):
                feedback_map[str(fb["axis"])] = fb

    # 축 점수 → AxisScores 구성
    score_values = {key: rubric_results[key][0] for key, _ in AXIS_KEYS}
    scores = AxisScores(**score_values)

    # totalScore: not_evaluated(None) 축 제외 평균
    evaluated = [v for v in score_values.values() if v is not None]
    total_score = _clamp(round(sum(evaluated) / len(evaluated))) if evaluated else 0

    summary = str(data.get("summary", ""))

    axis_feedbacks = []
    for key, label in AXIS_KEYS:
        score, fb_type = rubric_results[key]
        fb_data = feedback_map.get(key, {})
        axis_label = str(fb_data.get("axisLabel", label))
        if fb_type == "not_evaluated":
            feedback_text = "해당 역량을 평가할 수 있는 답변이 충분하지 않습니다."
        else:
            feedback_text = str(fb_data.get("feedback", ""))
        axis_feedbacks.append(AxisFeedback(
            axis=key,
            axisLabel=axis_label,
            score=score,
            type=fb_type,
            feedback=feedback_text,
        ))

    return ReportResponse(
        scores=scores,
        totalScore=total_score,
        summary=summary,
        axisFeedbacks=axis_feedbacks,
        signals=dataclasses.asdict(combined) if combined.has_content else None,
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


# ── 공개 API ──────────────────────────────────────────────────────────────────

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

    # 1. 각 답변 분석 (결정론적)
    signals_list = [analyze(item.answer) for item in history]

    # 2. 집계
    combined = _aggregate_signals(signals_list)

    # 3. 루브릭 적용 → 점수 계산 (결정론적)
    rubric_results = _apply_rubric(combined)

    # 4. LLM 호출: 피드백 텍스트만 생성
    prompt = _build_prompt_v2(resumeText, history, rubric_results)
    result = _call_llm(
        prompt,
        model=model,
        timeout=60.0,
        max_tokens=2048,
        error_message="리포트 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    )

    # 5. 응답 조합 (규칙 기반 점수 + LLM 피드백 텍스트)
    return (
        _parse_report_v2(result.content, rubric_results, combined),
        _usage_to_metadata(result.usage, result.model),
    )
