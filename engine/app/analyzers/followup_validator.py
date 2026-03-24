"""
engine/app/analyzers/followup_validator.py

followup 질문과 weak_part 간 코사인 유사도 검증 + 재생성 루프.
"""
import logging
from app.analyzers.overlap import cosine_similarity

OVERLAP_THRESHOLD: float = 0.5
MAX_REGENERATION_ATTEMPTS: int = 2
logger = logging.getLogger(__name__)


def validate_followup_overlap(
    followup_question: str,
    weak_part: str,
    generate_fn,
    get_embeddings_fn,
    initial_response,
):
    """followup_question과 weak_part의 코사인 유사도를 검증하고,
    threshold 미달 시 최대 MAX_REGENERATION_ATTEMPTS회 재생성한다.

    Args:
        followup_question: 초기 followup 질문 텍스트
        weak_part: 비교 대상 텍스트 (약점 부분)
        generate_fn: Callable[[], tuple[FollowupResponse, UsageMetadata | None]]
        get_embeddings_fn: Callable[[list[str]], tuple[list[list[float]], None]]
        initial_response: tuple[FollowupResponse, UsageMetadata | None]

    Returns:
        최종 선택된 (FollowupResponse, UsageMetadata | None) 튜플
    """
    current_response = initial_response
    current_question = followup_question

    for attempt in range(MAX_REGENERATION_ATTEMPTS):
        try:
            embeddings, _ = get_embeddings_fn([current_question, weak_part])
        except Exception as e:
            logger.warning("embedding 실패, 검증 스킵: %s", e)
            return current_response

        score = cosine_similarity(embeddings[0], embeddings[1])

        if score >= OVERLAP_THRESHOLD:
            logger.info(
                "overlap 검증 통과: attempt=%d, score=%.4f, threshold=%.1f",
                attempt + 1,
                score,
                OVERLAP_THRESHOLD,
            )
            return current_response

        logger.info(
            "overlap 미달, 재생성: attempt=%d, score=%.4f, threshold=%.1f",
            attempt + 1,
            score,
            OVERLAP_THRESHOLD,
        )
        current_response = generate_fn()
        current_question = current_response[0].followupQuestion

    logger.info("최대 재생성 횟수 도달, 마지막 결과 반환")
    return current_response
