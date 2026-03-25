import logging
from openai import OpenAI
from app.config import settings

logger = logging.getLogger(__name__)

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.openrouter_api_key,
        )
    return _client


def get_embeddings(
    texts: list[str], model: str = "text-embedding-3-small"
) -> tuple[list[list[float]], None]:
    """text-embedding-3-small (OpenRouter)으로 텍스트 임베딩 생성 (1536차원)"""
    if not settings.openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY 환경변수가 설정되지 않았습니다")
    response = _get_client().embeddings.create(model=model, input=texts)
    embeddings: list[list[float]] = [item.embedding for item in response.data]
    return embeddings, None
