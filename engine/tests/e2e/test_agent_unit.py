"""agent.py / reporter.py 단위 테스트.

RUN_E2E_AGENT 없이도 CI에서 항상 실행된다 (mock LLM 사용, 실제 서버 불필요).
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from tests.e2e.agent import CandidateAgent
from tests.e2e.reporter import (
    AXIS_KEYS,
    SessionResult,
    compute_stats,
    save_result,
)
from tests.e2e.runner import format_feedback


# ── 픽스처 ──────────────────────────────────────────────────────────────────

def _make_mock_llm(response: str = "테스트 답변입니다."):
    """항상 고정 문자열을 반환하는 mock LLM 함수."""
    def _fn(prompt: str) -> str:  # noqa: ARG001
        return response
    return _fn


def _make_result(
    variant: str = "v1",
    total_score: int = 70,
    scores: dict | None = None,
) -> SessionResult:
    if scores is None:
        scores = {axis: total_score for axis in AXIS_KEYS}
    return SessionResult(
        run_id="test-run-id",
        timestamp="2026-01-01T00:00:00+00:00",
        variant=variant,
        scores=scores,
        total_score=total_score,
        turn_count=10,
        history=[],
        duration_sec=12.5,
    )


# ── CandidateAgent 단위 테스트 ───────────────────────────────────────────────

class TestCandidateAgent:
    def test_generates_answer_with_mock_llm(self):
        agent = CandidateAgent(llm_fn=_make_mock_llm("안녕하세요, 저는 홍길동입니다."))
        answer = agent.generate_answer(
            question="자기소개를 해주세요.",
            resume_text="홍길동, 3년차 백엔드 개발자.",
            history=[],
        )
        assert answer == "안녕하세요, 저는 홍길동입니다."

    def test_answer_truncated_to_5000_chars(self):
        long_answer = "A" * 6000
        agent = CandidateAgent(llm_fn=_make_mock_llm(long_answer))
        answer = agent.generate_answer("질문", "이력서", [])
        assert len(answer) == 5000

    def test_uses_v1_prompt_by_default(self):
        agent = CandidateAgent(llm_fn=_make_mock_llm())
        assert agent.prompt_variant == "v1"

    def test_uses_v2_prompt_when_specified(self):
        agent = CandidateAgent(llm_fn=_make_mock_llm(), prompt_variant="v2")
        assert agent.prompt_variant == "v2"

    def test_prompt_contains_question(self):
        captured: list[str] = []

        def capture_llm(prompt: str) -> str:
            captured.append(prompt)
            return "답변"

        agent = CandidateAgent(llm_fn=capture_llm)
        agent.generate_answer("팀워크 경험을 말씀해주세요.", "이력서 내용", [])
        assert "팀워크 경험을 말씀해주세요." in captured[0]

    def test_prompt_contains_resume_text(self):
        captured: list[str] = []

        def capture_llm(prompt: str) -> str:
            captured.append(prompt)
            return "답변"

        agent = CandidateAgent(llm_fn=capture_llm)
        agent.generate_answer("질문", "홍길동 Python 개발자", [])
        assert "홍길동 Python 개발자" in captured[0]

    def test_prompt_contains_history(self):
        captured: list[str] = []

        def capture_llm(prompt: str) -> str:
            captured.append(prompt)
            return "답변"

        agent = CandidateAgent(llm_fn=capture_llm)
        history = [{"question": "이전 질문", "answer": "이전 답변"}]
        agent.generate_answer("현재 질문", "이력서", history)
        assert "이전 질문" in captured[0]
        assert "이전 답변" in captured[0]

    def test_empty_history_does_not_crash(self):
        agent = CandidateAgent(llm_fn=_make_mock_llm())
        answer = agent.generate_answer("질문", "이력서", [])
        assert isinstance(answer, str)

    def test_prompt_template_cached_after_first_load(self):
        agent = CandidateAgent(llm_fn=_make_mock_llm())
        agent.generate_answer("q1", "r", [])
        first_template = agent._prompt_template
        agent.generate_answer("q2", "r", [])
        assert agent._prompt_template is first_template  # 같은 객체 (캐시됨)

    def test_prior_feedback_included_in_prompt(self):
        captured: list[str] = []

        def capture_llm(prompt: str) -> str:
            captured.append(prompt)
            return "답변"

        feedback = "- 논리적 사고 (60점, improvement): 답변에 구체적 수치가 부족합니다."
        agent = CandidateAgent(llm_fn=capture_llm, prior_feedback=feedback)
        agent.generate_answer("질문", "이력서", [])
        assert feedback in captured[0]

    def test_empty_prior_feedback_does_not_crash(self):
        agent = CandidateAgent(llm_fn=_make_mock_llm(), prior_feedback="")
        answer = agent.generate_answer("질문", "이력서", [])
        assert isinstance(answer, str)


# ── reporter 단위 테스트 ─────────────────────────────────────────────────────

class TestFormatFeedback:
    def test_formats_axis_feedback(self):
        feedback = [
            {"axis": "communication", "axisLabel": "의사소통", "score": 85, "type": "strength", "feedback": "명확하게 표현했습니다."},
            {"axis": "problemSolving", "axisLabel": "문제해결", "score": 60, "type": "improvement", "feedback": "구체적 수치가 부족합니다."},
        ]
        result = format_feedback(feedback)
        assert "의사소통" in result
        assert "85점" in result
        assert "strength" in result
        assert "문제해결" in result
        assert "구체적 수치가 부족합니다." in result

    def test_empty_feedback_returns_empty_string(self):
        assert format_feedback([]) == ""

    def test_none_score_shows_unevaluated(self):
        feedback = [{"axis": "leadership", "axisLabel": "리더십", "score": None, "type": "not_evaluated", "feedback": "평가 불가"}]
        result = format_feedback(feedback)
        assert "미평가" in result


class TestComputeStats:
    def test_single_result_std_is_zero(self):
        result = _make_result(total_score=75)
        stats = compute_stats([result])
        assert stats["total_score"]["std"] == 0.0

    def test_single_result_mean_equals_score(self):
        result = _make_result(total_score=80)
        stats = compute_stats([result])
        assert stats["total_score"]["mean"] == 80.0

    def test_multiple_results_mean(self):
        results = [_make_result(total_score=s) for s in [60, 70, 80]]
        stats = compute_stats(results)
        assert stats["total_score"]["mean"] == pytest.approx(70.0)

    def test_multiple_results_std(self):
        import statistics as st
        scores = [60, 70, 80]
        results = [_make_result(total_score=s) for s in scores]
        stats = compute_stats(results)
        expected_std = st.stdev(scores)
        assert stats["total_score"]["std"] == pytest.approx(expected_std, rel=1e-3)

    def test_delta_first_vs_last(self):
        results = [_make_result(total_score=60), _make_result(total_score=80)]
        stats = compute_stats(results)
        assert stats["delta"]["total_score"] == 20

    def test_delta_negative(self):
        results = [_make_result(total_score=80), _make_result(total_score=60)]
        stats = compute_stats(results)
        assert stats["delta"]["total_score"] == -20

    def test_single_result_delta_none(self):
        result = _make_result(total_score=70)
        stats = compute_stats([result])
        assert stats["delta"]["total_score"] is None

    def test_axis_none_score_handled(self):
        scores = {axis: None for axis in AXIS_KEYS}
        result = _make_result(scores=scores)
        stats = compute_stats([result])
        for axis in AXIS_KEYS:
            assert stats["axes"][axis]["mean"] == 0.0
            assert stats["axes"][axis]["std"] == 0.0

    def test_empty_results_returns_empty(self):
        stats = compute_stats([])
        assert stats == {}


class TestSaveResult:
    def test_creates_json_file(self, tmp_path: Path):
        result = _make_result()
        path = save_result(result, tmp_path)
        assert path.exists()
        assert path.suffix == ".json"

    def test_json_content_is_valid(self, tmp_path: Path):
        result = _make_result(total_score=77)
        path = save_result(result, tmp_path)
        data = json.loads(path.read_text(encoding="utf-8"))
        assert data["total_score"] == 77
        assert data["variant"] == "v1"
        assert "scores" in data
        assert "history" in data
        assert "feedback" in data
        assert "summary" in data

    def test_filename_contains_variant(self, tmp_path: Path):
        result = _make_result(variant="v2")
        path = save_result(result, tmp_path)
        assert "v2" in path.name

    def test_creates_directory_if_not_exists(self, tmp_path: Path):
        nested = tmp_path / "deep" / "nested"
        result = _make_result()
        path = save_result(result, nested)
        assert path.exists()
