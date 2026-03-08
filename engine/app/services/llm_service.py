from openai import OpenAI
from pathlib import Path
from app.config import settings
from app.parsers.exceptions import LLMError
from app.schemas import QuestionItem
from app.services.output_parser import parse_llm_response

PROMPT_FILE = Path(__file__).parent.parent / "prompts" / "question_generation_v1.md"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


def generate_questions(
    resume_text: str,
    *,
    model: str | None = None,
    max_input_chars: int = 16000,
    timeout_seconds: float = 30.0,
) -> list[QuestionItem]:
    truncated_text = resume_text[:max_input_chars]

    prompt_template = PROMPT_FILE.read_text(encoding="utf-8")
    prompt = prompt_template.replace("{resume_text}", truncated_text)

    client = OpenAI(
        base_url=OPENROUTER_BASE_URL,
        api_key=settings.openrouter_api_key,
    )
    resolved_model = model or settings.openrouter_model

    try:
        response = client.chat.completions.create(
            model=resolved_model,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
            timeout=timeout_seconds,
        )
        raw = response.choices[0].message.content
    except Exception as e:
        raise LLMError("질문 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.") from e

    return parse_llm_response(raw)
