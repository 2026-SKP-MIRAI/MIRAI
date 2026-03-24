from .text_analyzer import analyze, TextSignals
from .overlap import cosine_similarity
from .followup_validator import validate_followup_overlap, OVERLAP_THRESHOLD

__all__ = [
    "analyze",
    "TextSignals",
    "cosine_similarity",
    "validate_followup_overlap",
    "OVERLAP_THRESHOLD",
]
