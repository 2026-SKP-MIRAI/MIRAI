"""
tests/unit/analyzers/test_followup_validator.py
validate_followup_overlap 단위 테스트.
"""
import logging
import pytest
from unittest.mock import MagicMock
from app.analyzers.followup_validator import validate_followup_overlap, OVERLAP_THRESHOLD, MAX_REGENERATION_ATTEMPTS
from app.schemas import FollowupResponse


def _make_response(question: str):
    return (
        FollowupResponse(
            followupType="CLARIFY",
            followupQuestion=question,
            reasoning="test reasoning",
        ),
        None,
    )


class TestValidateFollowupOverlap:
    def test_overlap_sufficient_no_regeneration(self):
        """score >= threshold → 재생성 없음, generate_fn 0회 호출."""
        initial = _make_response("question A")
        generate_fn = MagicMock()

        # 1차: weak_part 임베딩, 2차: question 임베딩 (동일 벡터 → score 1.0)
        weak_vec = [[1.0, 0.0]]
        q_vec = [[1.0, 0.0]]
        get_embeddings_fn = MagicMock(side_effect=[(weak_vec, None), (q_vec, None)])

        result = validate_followup_overlap(
            followup_question="question A",
            weak_part="weak part",
            generate_fn=generate_fn,
            get_embeddings_fn=get_embeddings_fn,
            initial_response=initial,
        )

        assert result == initial
        generate_fn.assert_not_called()

    def test_overlap_low_first_then_pass(self):
        """1차 score 낮음 → 재생성 → 2차 score 통과 → generate_fn 1회 호출."""
        initial = _make_response("question A")
        regenerated = _make_response("question B")
        generate_fn = MagicMock(return_value=regenerated)

        # weak_part 임베딩(1회) + question 임베딩(2회: 1차 미달, 2차 통과)
        weak_vec = [[0.0, 1.0]]
        q_vec_low = [[1.0, 0.0]]    # cosine([1,0], [0,1]) = 0.0
        q_vec_high = [[0.0, 1.0]]   # cosine([0,1], [0,1]) = 1.0
        get_embeddings_fn = MagicMock(
            side_effect=[(weak_vec, None), (q_vec_low, None), (q_vec_high, None)]
        )

        result = validate_followup_overlap(
            followup_question="question A",
            weak_part="weak part",
            generate_fn=generate_fn,
            get_embeddings_fn=get_embeddings_fn,
            initial_response=initial,
        )

        assert result == regenerated
        generate_fn.assert_called_once()

    def test_max_attempts_reached(self):
        """매번 score 낮음 → MAX_REGENERATION_ATTEMPTS 후 마지막 결과 반환."""
        initial = _make_response("question A")
        last = _make_response("question Z")

        responses = [_make_response(f"q{i}") for i in range(MAX_REGENERATION_ATTEMPTS - 1)] + [last]
        generate_fn = MagicMock(side_effect=responses)

        # weak_part 임베딩(1회) + question 임베딩(매번 직교 → 항상 낮은 score)
        weak_vec = [[0.0, 1.0]]
        q_vec_low = [[1.0, 0.0]]  # cosine = 0.0
        get_embeddings_fn = MagicMock(
            side_effect=[(weak_vec, None)] + [(q_vec_low, None)] * MAX_REGENERATION_ATTEMPTS
        )

        result = validate_followup_overlap(
            followup_question="question A",
            weak_part="weak part",
            generate_fn=generate_fn,
            get_embeddings_fn=get_embeddings_fn,
            initial_response=initial,
        )

        assert result == last
        assert generate_fn.call_count == MAX_REGENERATION_ATTEMPTS

    def test_embedding_failure_on_weak_part(self):
        """weak_part embedding 실패 → 초기 결과 반환, 예외 전파 없음."""
        initial = _make_response("question A")
        generate_fn = MagicMock()
        get_embeddings_fn = MagicMock(side_effect=Exception("embedding 서비스 오류"))

        result = validate_followup_overlap(
            followup_question="question A",
            weak_part="weak part",
            generate_fn=generate_fn,
            get_embeddings_fn=get_embeddings_fn,
            initial_response=initial,
        )

        assert result == initial
        generate_fn.assert_not_called()

    def test_embedding_failure_on_question(self):
        """question embedding 실패 → 초기 결과 반환, 예외 전파 없음."""
        initial = _make_response("question A")
        generate_fn = MagicMock()

        weak_vec = [[1.0, 0.0]]
        get_embeddings_fn = MagicMock(
            side_effect=[(weak_vec, None), Exception("question embedding 오류")]
        )

        result = validate_followup_overlap(
            followup_question="question A",
            weak_part="weak part",
            generate_fn=generate_fn,
            get_embeddings_fn=get_embeddings_fn,
            initial_response=initial,
        )

        assert result == initial
        generate_fn.assert_not_called()

    def test_empty_followup_question_returns_early(self):
        """재생성된 followupQuestion이 빈 문자열이면 즉시 반환."""
        initial = _make_response("question A")
        empty_response = _make_response("")
        generate_fn = MagicMock(return_value=empty_response)

        weak_vec = [[0.0, 1.0]]
        q_vec_low = [[1.0, 0.0]]  # cosine = 0.0
        get_embeddings_fn = MagicMock(
            side_effect=[(weak_vec, None), (q_vec_low, None)]
        )

        result = validate_followup_overlap(
            followup_question="question A",
            weak_part="weak part",
            generate_fn=generate_fn,
            get_embeddings_fn=get_embeddings_fn,
            initial_response=initial,
        )

        assert result == empty_response
        generate_fn.assert_called_once()

    def test_logging_on_retry(self, caplog):
        """재생성 발생 시 INFO 로그에 attempt, score, threshold 포함."""
        initial = _make_response("question A")
        regenerated = _make_response("question B")
        generate_fn = MagicMock(return_value=regenerated)

        weak_vec = [[0.0, 1.0]]
        q_vec_low = [[1.0, 0.0]]    # cosine = 0.0
        q_vec_high = [[0.0, 1.0]]   # cosine = 1.0
        get_embeddings_fn = MagicMock(
            side_effect=[(weak_vec, None), (q_vec_low, None), (q_vec_high, None)]
        )

        with caplog.at_level(logging.INFO, logger="app.analyzers.followup_validator"):
            validate_followup_overlap(
                followup_question="question A",
                weak_part="weak part",
                generate_fn=generate_fn,
                get_embeddings_fn=get_embeddings_fn,
                initial_response=initial,
            )

        retry_logs = [r for r in caplog.records if "overlap 미달" in r.message or "재생성" in r.message]
        assert len(retry_logs) >= 1
        log_text = retry_logs[0].message
        assert "attempt" in log_text
        assert "score" in log_text
        assert "threshold" in log_text
