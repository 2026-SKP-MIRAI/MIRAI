"""
tests/unit/analyzers/test_overlap.py
cosine_similarity 순수 Python 구현 단위 테스트.
"""
import math
import pytest
from app.analyzers.overlap import cosine_similarity


class TestCosineSimilarity:
    def test_identical_vectors(self):
        assert cosine_similarity([1, 0, 0], [1, 0, 0]) == pytest.approx(1.0)

    def test_orthogonal_vectors(self):
        assert cosine_similarity([1, 0], [0, 1]) == pytest.approx(0.0)

    def test_opposite_vectors(self):
        assert cosine_similarity([1, 0], [-1, 0]) == pytest.approx(-1.0)

    def test_zero_vector_a(self):
        assert cosine_similarity([0, 0], [1, 0]) == 0.0

    def test_zero_vector_both(self):
        assert cosine_similarity([0, 0], [0, 0]) == 0.0

    def test_partial_similarity(self):
        result = cosine_similarity([1, 1, 0], [1, 0, 0])
        assert 0.0 < result < 1.0

    def test_1024_dim_identical(self):
        vec = [1.0] * 1024
        assert cosine_similarity(vec, vec) == pytest.approx(1.0)

    def test_1024_dim_orthogonal(self):
        a = [1.0] + [0.0] * 1023
        b = [0.0] + [1.0] + [0.0] * 1022
        assert cosine_similarity(a, b) == pytest.approx(0.0)

    def test_symmetry(self):
        a = [0.5, 0.3, 0.8]
        b = [0.1, 0.9, 0.2]
        assert cosine_similarity(a, b) == pytest.approx(cosine_similarity(b, a))
