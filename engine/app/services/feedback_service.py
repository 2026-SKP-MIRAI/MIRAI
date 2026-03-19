import json
from pathlib import Path
from app.parsers.exceptions import ResumeFeedbackParseError
from app.schemas import ResumeFeedbackResponse, ResumeFeedbackScores, SuggestionItem
from app.services.llm_client import call_llm, strip_code_block

PROMPT_DIR = Path(__file__).parent.parent / "prompts"

SCORE_KEYS = ["specificity", "achievementClarity", "logicStructure",
              "roleAlignment", "differentiation"]


def _validate_score(key: str, val: int | None) -> int:
    if not isinstance(val, int) or not (0 <= val <= 100):
        raise ResumeFeedbackParseError(f"scores.{key} 값이 유효하지 않음: {val}")
    return val


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

    # scores 파싱 — 5개 키 전부 있어야 하며 null 값도 불허
    raw_scores = data.get("scores", {}) if isinstance(data.get("scores"), dict) else {}
    missing = [key for key in SCORE_KEYS if key not in raw_scores or raw_scores[key] is None]
    if missing:
        raise ResumeFeedbackParseError(f"scores 키 누락 또는 null: {missing}")
    score_values = {key: _validate_score(key, raw_scores[key]) for key in SCORE_KEYS}
    scores = ResumeFeedbackScores(**score_values)

    # strengths/weaknesses — truncate 후 2개 미만 시 에러
    def _require_str_list(key: str, min_count: int, max_count: int) -> list[str]:
        raw = data.get(key, [])
        if not isinstance(raw, list):
            raise ResumeFeedbackParseError(f"{key}가 배열이 아닙니다")
        items = [str(x) for x in raw if str(x).strip()][:max_count]
        if len(items) < min_count:
            raise ResumeFeedbackParseError(f"{key}는 최소 {min_count}개 필요합니다. 현재 {len(items)}개")
        return items

    strengths  = _require_str_list("strengths",  min_count=2, max_count=3)
    weaknesses = _require_str_list("weaknesses", min_count=2, max_count=3)

    # suggestions — 1개 이상 필수
    raw_sug = data.get("suggestions", [])
    if not isinstance(raw_sug, list):
        raise ResumeFeedbackParseError("suggestions가 배열이 아닙니다")
    suggestions = [
        SuggestionItem(
            section=str(s.get("section", "")),
            issue=str(s.get("issue", "")),
            suggestion=str(s.get("suggestion", "")),
        )
        for s in raw_sug
        if isinstance(s, dict)
    ]
    if not suggestions:
        raise ResumeFeedbackParseError("suggestions는 최소 1개 필요합니다")

    return ResumeFeedbackResponse(
        scores=scores,
        strengths=strengths,
        weaknesses=weaknesses,
        suggestions=suggestions,
    )


def generate_resume_feedback(
    resume_text: str,
    target_role: str | None = None,
    *,
    model: str | None = None,
) -> ResumeFeedbackResponse:
    role_label = target_role.strip() if target_role and target_role.strip() else "미지정 직무"
    prompt = _build_prompt(resume_text, role_label)
    raw = call_llm(
        prompt,
        model=model,
        timeout=30.0,
        max_tokens=2048,
        error_message="이력서 피드백 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    )
    return _parse_feedback(raw)
