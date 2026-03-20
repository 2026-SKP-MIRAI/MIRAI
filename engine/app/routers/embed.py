import logging
from fastapi import APIRouter
from app.schemas import EmbedRequest, EmbedResponse
from app.services.embedding_service import get_embeddings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/embed")


@router.post("", response_model=EmbedResponse)
async def create_embeddings(body: EmbedRequest):
    logger.info("[embed] 요청 수신: texts %d개, model=%s", len(body.texts), body.model)
    embeddings, usage = get_embeddings(body.texts, body.model)
    logger.info("[embed] 임베딩 완료: %d개", len(embeddings))
    return EmbedResponse(embeddings=embeddings, model=body.model, usage=usage)
