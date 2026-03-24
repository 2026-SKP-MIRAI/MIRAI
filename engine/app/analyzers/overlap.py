"""
engine/app/analyzers/overlap.py

코사인 유사도 순수 Python 구현.
외부 의존성 없음 (math 표준 라이브러리만 사용).
numpy/scipy 금지 — 경량 유지.
"""
import math


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """두 벡터의 코사인 유사도를 반환한다.

    Args:
        a: 첫 번째 벡터 (list of float)
        b: 두 번째 벡터 (list of float, len(a) == len(b) 가정)

    Returns:
        코사인 유사도 [-1.0, 1.0]. zero vector 입력 시 0.0 반환.
    """
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)
