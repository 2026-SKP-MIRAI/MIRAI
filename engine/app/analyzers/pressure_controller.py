"""압박도(pressure) 분류 모듈. LLM 미사용, 결정론적."""
from app.analyzers.text_analyzer import TextSignals
from app.schemas import FollowupType

ANSWER_QUALITY_CHALLENGE_THRESHOLD: float = 60.0
VAGUE_RATIO_PRESSURE_THRESHOLD: float = 0.04


def calc_answer_quality(signals: TextSignals) -> float:
    """(star_score*0.5 + specificity_score*0.3 + achievement_score*0.2) * 100"""
    return (
        signals.star_score * 0.5
        + signals.specificity_score * 0.3
        + signals.achievement_score * 0.2
    ) * 100


def classify_pressure(signals: TextSignals) -> FollowupType:
    """우선순위: has_content=False→CLARIFY, vague>0.04→CLARIFY, agency==0→CLARIFY, quality<60→CHALLENGE, else→EXPLORE"""
    if not signals.has_content:
        return "CLARIFY"
    if signals.vague_ratio > VAGUE_RATIO_PRESSURE_THRESHOLD:
        return "CLARIFY"
    if signals.agency_verb_count == 0:
        return "CLARIFY"
    if calc_answer_quality(signals) < ANSWER_QUALITY_CHALLENGE_THRESHOLD:
        return "CHALLENGE"
    return "EXPLORE"
