from pathlib import Path
from app.schemas import QuestionItem, UsageMetadata
from app.services.llm_client import call_llm, UsageInfo
from app.services.output_parser import parse_llm_response

PROMPT_FILE = Path(__file__).parent.parent / "prompts" / "question_generation_v1.md"


def _usage_to_metadata(usage: UsageInfo | None, model: str) -> UsageMetadata | None:
    if usage is None:
        return None
    return UsageMetadata(
        prompt_tokens=usage.prompt_tokens,
        completion_tokens=usage.completion_tokens,
        total_tokens=usage.total_tokens,
        model=model,
    )


def generate_questions(
    resume_text: str,
    *,
    target_role: str | None = None,
    model: str | None = None,
    max_input_chars: int = 16000,
    timeout_seconds: float = 30.0,
) -> tuple[list[QuestionItem], UsageMetadata | None]:
    # TODO: 향후 XML 기반 프롬프트 템플릿 엔진 도입 시 이스케이프 로직 중앙화 필요.
    # < > 전체를 HTML 엔티티로 치환해 XML 태그 인젝션(여는 태그·닫는 태그 모두)을 방지한다.
    truncated_text = resume_text[:max_input_chars].replace("<", "&lt;").replace(">", "&gt;")
    prompt = PROMPT_FILE.read_text(encoding="utf-8").replace("{resume_text}", truncated_text)
    if target_role and target_role.strip():
        safe_role = target_role.strip().replace("<", "&lt;").replace(">", "&gt;")
        prompt += (
            f"\n\n지원 직무가 '{safe_role}'로 확정되었습니다. "
            f"이 직무에 맞춤화된 질문을 생성하세요."
        )
    result = call_llm(
        prompt,
        model=model,
        timeout=timeout_seconds,
        max_tokens=4096,
        error_message="질문 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    )
    questions = parse_llm_response(result.content)
    return questions, _usage_to_metadata(result.usage, result.model)
