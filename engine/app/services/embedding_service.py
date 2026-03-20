import logging
import google.generativeai as genai
from app.config import settings

logger = logging.getLogger(__name__)

# 모듈 초기화 시 한 번만 configure (매 요청마다 재설정 방지)
if settings.gemini_api_key:
    genai.configure(api_key=settings.gemini_api_key)


def get_embeddings(
    texts: list[str], model: str = "text-embedding-004"
) -> tuple[list[list[float]], None]:
    """Gemini text-embedding-004으로 텍스트 임베딩 생성 (768차원)"""
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY 환경변수가 설정되지 않았습니다")
    result = genai.embed_content(
        model=f"models/{model}",
        content=texts,
        task_type="retrieval_document",
    )
    embeddings: list[list[float]] = (
        [result["embedding"]]
        if isinstance(result["embedding"][0], float)
        else result["embedding"]
    )
    for emb in embeddings:
        if len(emb) != 768:
            raise ValueError(f"예상 768차원, 실제 {len(emb)}차원")
    return embeddings, None
