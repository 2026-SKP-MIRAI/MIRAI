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
    texts: list[str], model: str = "baai/bge-m3"
) -> tuple[list[list[float]], None]:
    """baai/bge-m3 (OpenRouter)으로 텍스트 임베딩 생성 (1024차원)"""
    if not settings.openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY 환경변수가 설정되지 않았습니다")
    response = _get_client().embeddings.create(model=model, input=texts)
    embeddings: list[list[float]] = [item.embedding for item in response.data]
    for emb in embeddings:
        if len(emb) != 1024:
            raise ValueError(f"예상 1024차원, 실제 {len(emb)}차원")
    return embeddings, None
