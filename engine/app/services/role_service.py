from pathlib import Path
from app.parsers.exceptions import LLMError
from app.services.llm_client import call_llm, parse_object

PROMPT_FILE = Path(__file__).parent.parent / "prompts" / "target_role_v1.md"


def extract_target_role(
    resume_text: str,
    *,
    model: str | None = None,
    max_input_chars: int = 16000,
    timeout_seconds: float = 15.0,
) -> str:
    if not resume_text or not resume_text.strip():
        raise LLMError("resume_text가 비어 있습니다.")
    # TODO: 향후 XML 기반 프롬프트 템플릿 엔진 도입 시 이스케이프 로직 중앙화 필요.
    # < > 전체를 HTML 엔티티로 치환해 XML 태그 인젝션(여는 태그·닫는 태그 모두)을 방지한다.
    truncated = resume_text[:max_input_chars].replace("<", "&lt;").replace(">", "&gt;")
    prompt = PROMPT_FILE.read_text(encoding="utf-8").replace("{resume_text}", truncated)
    raw = call_llm(
        prompt,
        model=model,
        timeout=timeout_seconds,
        max_tokens=128,
        error_message="직무 추론 중 오류가 발생했습니다.",
    )
    data = parse_object(raw, required_keys=["targetRole"])
    role = data["targetRole"]
    if not isinstance(role, str) or not role.strip():
        return "미지정"
    return role.strip()[:100]
