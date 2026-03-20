import json
from pathlib import Path
from app.parsers.exceptions import LLMError, PracticeParseError
from app.schemas import PracticeFeedbackResponse, FeedbackDetail, ComparisonDelta, UsageMetadata
from app.services.llm_client import call_llm, strip_code_block, UsageInfo

PROMPT_DIR = Path(__file__).parent.parent / "prompts"


def _clamp(val) -> int:
    try:
        return max(0, min(100, int(val)))
    except (TypeError, ValueError):
        return 50


def _build_prompt(question: str, answer: str) -> str:
    template = (PROMPT_DIR / "practice_feedback_v1.md").read_text(encoding="utf-8")
    return template.replace("{question}", question).replace("{answer}", answer[:5000])


def _build_retry_prompt(question: str, previous_answer: str, answer: str) -> str:
    template = (PROMPT_DIR / "practice_feedback_retry_v1.md").read_text(encoding="utf-8")
    return (
        template
        .replace("{question}", question)
        .replace("{previous_answer}", previous_answer[:5000])
        .replace("{answer}", answer[:5000])
    )


def _parse_delta(data: dict) -> ComparisonDelta | None:
    raw = data.get("comparisonDelta")
    if not isinstance(raw, dict):
        return None
    try:
        score_delta = int(raw.get("scoreDelta", 0))
    except (TypeError, ValueError):
        score_delta = 0
    raw_imp = raw.get("improvements", [])
    improvements = [str(x) for x in raw_imp] if isinstance(raw_imp, list) else []
    return ComparisonDelta(scoreDelta=score_delta, improvements=improvements)


def _parse_feedback(raw: str, *, is_retry: bool = False) -> PracticeFeedbackResponse:
    try:
        s = strip_code_block(raw)
        data = json.loads(s)
    except json.JSONDecodeError as e:
        raise PracticeParseError(f"연습 피드백 JSON 파싱 실패: {e}") from e

    if not isinstance(data, dict):
        raise PracticeParseError("연습 피드백 응답이 객체가 아닙니다")

    score = _clamp(data.get("score", 50))

    raw_fb = data.get("feedback", {})
    if not isinstance(raw_fb, dict):
        raw_fb = {}
    raw_good    = raw_fb.get("good", [])
    raw_improve = raw_fb.get("improve", [])
    good    = [str(x) for x in raw_good    if str(x).strip()][:3] or ["강점을 확인하지 못했습니다"]
    improve = [str(x) for x in raw_improve if str(x).strip()][:3] or ["개선 포인트를 찾지 못했습니다"]

    raw_kw   = data.get("keywords", [])
    keywords = [str(x) for x in raw_kw if str(x).strip()][:5] or ["STAR 구조"]

    guide = str(data.get("improvedAnswerGuide", "")).strip() or "가이드를 생성하지 못했습니다."

    delta = _parse_delta(data) if is_retry else None

    return PracticeFeedbackResponse(
        score=score,
        feedback=FeedbackDetail(good=good, improve=improve),
        keywords=keywords,
        improvedAnswerGuide=guide,
        comparisonDelta=delta,
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


def generate_practice_feedback(
    question: str,
    answer: str,
    previous_answer: str | None = None,
    *,
    previous_score: int | None = None,
    model: str | None = None,
) -> tuple[PracticeFeedbackResponse, UsageMetadata | None]:
    is_retry = previous_answer is not None
    prompt = _build_retry_prompt(question, previous_answer, answer) if is_retry \
             else _build_prompt(question, answer)
    result = call_llm(
        prompt,
        model=model,
        timeout=30.0,
        max_tokens=2048,
        error_message="연습 피드백 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    )
    response = _parse_feedback(result.content, is_retry=is_retry)

    if response.comparisonDelta is not None and previous_score is not None:
        response.comparisonDelta.scoreDelta = max(-100, min(100, response.score - previous_score))

    return response, _usage_to_metadata(result.usage, result.model)
