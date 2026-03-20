import json
from dataclasses import dataclass
from openai import OpenAI
from app.config import settings
from app.parsers.exceptions import LLMError

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


@dataclass
class UsageInfo:
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


@dataclass
class LLMResult:
    content: str
    usage: UsageInfo | None
    model: str


def strip_code_block(raw: str) -> str:
    s = raw.strip()
    if s.startswith("```"):
        nl = s.find("\n")
        s = s[nl + 1:] if nl != -1 else s[3:]  # 개행 없으면 ``` 만 제거
    if s.endswith("```"):
        s = s[:s.rfind("```")]
    return s.strip()


def call_llm(
    prompt: str,
    *,
    model: str | None = None,
    timeout: float = 30.0,
    max_tokens: int = 2048,
    error_message: str = "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
) -> LLMResult:
    client = OpenAI(base_url=OPENROUTER_BASE_URL, api_key=settings.openrouter_api_key)
    resolved_model = model or settings.openrouter_model
    try:
        response = client.chat.completions.create(
            model=resolved_model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
            timeout=timeout,
        )
        content = response.choices[0].message.content
        if content is None:
            raise LLMError(error_message)
        raw_usage = response.usage
        usage = UsageInfo(
            prompt_tokens=raw_usage.prompt_tokens,
            completion_tokens=raw_usage.completion_tokens,
            total_tokens=raw_usage.total_tokens,
        ) if raw_usage else None
        return LLMResult(content=content, usage=usage, model=resolved_model)
    except LLMError:
        raise
    except Exception as e:
        raise LLMError(error_message) from e


def parse_object(raw: str, required_keys: list[str] | None = None) -> dict:
    """JSON 파싱 후 dict 반환. 배열로 반환된 경우 첫 번째 원소 사용."""
    try:
        data = json.loads(strip_code_block(raw))
    except json.JSONDecodeError as e:
        raise LLMError(f"LLM 응답이 유효한 JSON이 아닙니다: {e}") from e
    if isinstance(data, list):
        if not data:
            raise LLMError("LLM 응답 배열이 비어 있습니다")
        data = data[0]
    if not isinstance(data, dict):
        raise LLMError("LLM 응답이 객체가 아닙니다")
    if required_keys:
        missing = [k for k in required_keys if k not in data]
        if missing:
            raise LLMError(f"LLM 응답에 필수 키가 없습니다: {missing}")
    return data
