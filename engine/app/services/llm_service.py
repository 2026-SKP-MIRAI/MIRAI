from pathlib import Path
from app.schemas import QuestionItem
from app.services.llm_client import call_llm
from app.services.output_parser import parse_llm_response

PROMPT_FILE = Path(__file__).parent.parent / "prompts" / "question_generation_v1.md"


def generate_questions(
    resume_text: str,
    *,
    target_role: str | None = None,
    model: str | None = None,
    max_input_chars: int = 16000,
    timeout_seconds: float = 30.0,
) -> list[QuestionItem]:
    truncated_text = resume_text[:max_input_chars]
    prompt = PROMPT_FILE.read_text(encoding="utf-8").replace("{resume_text}", truncated_text)
    if target_role and target_role.strip():
        prompt += (
            f"\n\n지원 직무가 '{target_role.strip()}'로 확정되었습니다. "
            f"이 직무에 맞춤화된 질문을 생성하세요."
        )
    raw = call_llm(
        prompt,
        model=model,
        timeout=timeout_seconds,
        max_tokens=4096,
        error_message="질문 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    )
    return parse_llm_response(raw)
