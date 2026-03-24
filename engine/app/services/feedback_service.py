import json
import logging
from pathlib import Path
from app.parsers.exceptions import ResumeFeedbackParseError
from app.schemas import ResumeFeedbackResponse, ResumeFeedbackScores, SuggestionItem, UsageMetadata
from app.services.llm_client import call_llm, strip_code_block, UsageInfo

logger = logging.getLogger(__name__)

PROMPT_DIR = Path(__file__).parent.parent / "prompts"

SCORE_KEYS = ["specificity", "achievementClarity", "logicStructure",
              "roleAlignment", "differentiation"]


def _validate_score(key: str, val: int | None) -> int:
    if not isinstance(val, int) or not (0 <= val <= 100):
        raise ResumeFeedbackParseError(f"scores.{key} 값이 유효하지 않음: {val}")
    return val


def _build_prompt(
    resume_text: str,
    target_role: str,
    job_context: list[str] | None = None,
    resume_context: list[str] | None = None,
) -> str:
    template = (PROMPT_DIR / "resume_feedback_v1.md").read_text(encoding="utf-8")
    # TODO: 향후 XML 기반 프롬프트 템플릿 엔진 도입 시 이스케이프 로직 중앙화 필요.
    # < > 전체를 HTML 엔티티로 치환해 XML 태그 인젝션(여는 태그·닫는 태그 모두)을 방지한다.
    safe_resume = resume_text[:16000].replace("<", "&lt;").replace(">", "&gt;")
    safe_role = target_role.replace("<", "&lt;").replace(">", "&gt;")
    prompt = (
        template
        .replace("{resume_text}", safe_resume)
        .replace("{target_role}", safe_role)
    )
    if job_context:
        context_block = "\n\n## 관련 채용공고 컨텍스트\n"
        for i, ctx in enumerate(job_context, 1):
            safe_ctx = ctx[:2000].replace("<", "&lt;").replace(">", "&gt;")
            context_block += f"{i}. {safe_ctx}\n"
        context_block += "\n위 채용공고들을 참고하여 자소서의 직무 적합성을 평가해주세요."
        prompt += context_block
    if resume_context:
        resume_block = "\n\n## 유사 직무 합격 자소서 예시\n"
        resume_block += "아래는 동일/유사 직무에 합격한 실제 자소서 예시입니다. 이를 참고하여 평가해주세요.\n"
        for i, ctx in enumerate(resume_context[:5], 1):
            safe_ctx = ctx[:3000].replace("<", "&lt;").replace(">", "&gt;")
            resume_block += f"\n### 합격 예시 {i}\n{safe_ctx}\n"
        prompt += resume_block
    return prompt


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
        values = data.get(key, [])
        if not isinstance(values, list):
            raise ResumeFeedbackParseError(f"{key}가 배열이 아닙니다")
        items = [str(x) for x in values if str(x).strip()][:max_count]
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


def _usage_to_metadata(usage: UsageInfo | None, model: str) -> UsageMetadata | None:
    if usage is None:
        return None
    return UsageMetadata(
        prompt_tokens=usage.prompt_tokens,
        completion_tokens=usage.completion_tokens,
        total_tokens=usage.total_tokens,
        model=model,
    )


def generate_resume_feedback(
    resume_text: str,
    target_role: str | None = None,
    *,
    model: str | None = None,
    job_context: list[str] | None = None,
    resume_context: list[str] | None = None,
) -> tuple[ResumeFeedbackResponse, UsageMetadata | None]:
    role_label = target_role.strip() if target_role and target_role.strip() else "미지정 직무"
    if job_context:
        logger.info("[RAG:채용공고] job_context %d건 프롬프트 주입 (직무=%s)", len(job_context), role_label)
    if resume_context:
        logger.info("[RAG:합격자소서] resume_context %d건 프롬프트 주입 (직무=%s)", len(resume_context), role_label)
    if not job_context and not resume_context:
        logger.info("[RAG:미사용] 컨텍스트 없이 피드백 생성 (직무=%s)", role_label)
    prompt = _build_prompt(resume_text, role_label, job_context, resume_context)
    result = call_llm(
        prompt,
        model=model,
        timeout=30.0,
        max_tokens=2048,
        error_message="이력서 피드백 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    )
    return _parse_feedback(result.content), _usage_to_metadata(result.usage, result.model)
