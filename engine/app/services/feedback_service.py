import json
from pathlib import Path
from app.parsers.exceptions import ResumeFeedbackParseError
from app.schemas import ResumeFeedbackResponse, ResumeFeedbackScores, SuggestionItem
from app.services.llm_client import call_llm, strip_code_block

PROMPT_DIR = Path(__file__).parent.parent / "prompts"

SCORE_KEYS = ["specificity", "achievementClarity", "logicStructure",
              "roleAlignment", "differentiation"]


def _clamp(val) -> int:
    try:
        return max(0, min(100, int(val)))
    except (TypeError, ValueError):
        return 50


def _build_prompt(resume_text: str, target_role: str) -> str:
    template = (PROMPT_DIR / "resume_feedback_v1.md").read_text(encoding="utf-8")
    return (
        template
        .replace("{resume_text}", resume_text[:16000])
        .replace("{target_role}", target_role)
    )


def _parse_feedback(raw: str) -> ResumeFeedbackResponse:
    try:
        s = strip_code_block(raw)
        data = json.loads(s)
    except json.JSONDecodeError as e:
        raise ResumeFeedbackParseError(f"이력서 피드백 JSON 파싱 실패: {e}") from e

    if not isinstance(data, dict):
        raise ResumeFeedbackParseError("이력서 피드백 응답이 객체가 아닙니다")

    # scores 파싱 (누락 시 50점 fallback)
    raw_scores = data.get("scores", {}) if isinstance(data.get("scores"), dict) else {}
    score_values = {key: _clamp(raw_scores.get(key, 50)) for key in SCORE_KEYS}
    scores = ResumeFeedbackScores(**score_values)

    # strengths/weaknesses — truncate 후 2개 보장 (Pydantic min_length=2)
    def _safe_list(key: str, fallback: str) -> list[str]:
        raw = [str(x) for x in data.get(key, []) if str(x).strip()][:3]
        return raw if len(raw) >= 2 else raw + [fallback] * (2 - len(raw))

    strengths  = _safe_list("strengths",  "강점을 확인하지 못했습니다")
    weaknesses = _safe_list("weaknesses", "약점을 확인하지 못했습니다")

    # suggestions
    raw_sug = data.get("suggestions", [])
    if not isinstance(raw_sug, list):
        raw_sug = []
    suggestions = [
        SuggestionItem(
            section=str(s.get("section", "")),
            issue=str(s.get("issue", "")),
            suggestion=str(s.get("suggestion", "")),
        )
        for s in raw_sug
        if isinstance(s, dict)
    ]

    return ResumeFeedbackResponse(
        scores=scores,
        strengths=strengths,
        weaknesses=weaknesses,
        suggestions=suggestions,
    )


def generate_resume_feedback(
    resumeText: str,
    targetRole: str,
    *,
    model: str | None = None,
) -> ResumeFeedbackResponse:
    prompt = _build_prompt(resumeText[:16000], targetRole)
    raw = call_llm(
        prompt,
        model=model,
        timeout=30.0,
        max_tokens=2048,
        error_message="이력서 피드백 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    )
    return _parse_feedback(raw)
