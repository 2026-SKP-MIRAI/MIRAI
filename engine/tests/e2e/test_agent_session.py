"""E2E 통합 테스트 — 실제 LLM + 실제 엔진 서버 대상.

실행 조건: RUN_E2E_AGENT=true 환경변수 설정 + 엔진 서버 구동 중
비용 발생 주의: 단일 세션 약 10턴 × 2 LLM 호출
"""
from __future__ import annotations

from tests.e2e.agent import CandidateAgent
from tests.e2e.reporter import AXIS_KEYS, compute_stats, print_report, save_result
from tests.e2e.runner import RESULTS_DIR, run_session


_RESULTS_DIR = RESULTS_DIR


class TestSingleSession:
    def test_session_completes(self, base_url: str, e2e_pdf_bytes: bytes):
        """단일 세션이 정상 완주되고 8축 점수가 모두 반환된다."""
        agent = CandidateAgent(prompt_variant="v1")
        result = run_session(base_url, e2e_pdf_bytes, agent)

        assert result.turn_count >= 5, f"최소 5턴 필요, 실제: {result.turn_count}"
        assert result.total_score >= 0
        assert result.duration_sec > 0

        # 8축 키 존재 확인
        for axis in AXIS_KEYS:
            assert axis in result.scores, f"scores에 {axis} 축 없음"

        # 결과 저장
        path = save_result(result, _RESULTS_DIR)
        print(f"\n결과 저장: {path}")

    def test_session_history_not_empty(self, base_url: str, e2e_pdf_bytes: bytes):
        """세션 완주 후 history에 Q&A 이력이 존재한다."""
        agent = CandidateAgent(prompt_variant="v1")
        result = run_session(base_url, e2e_pdf_bytes, agent)

        assert len(result.history) >= 5
        for item in result.history:
            assert "question" in item
            assert "answer" in item
            assert "persona" in item
            assert len(item["answer"]) > 0, "빈 답변이 history에 포함됨"

    def test_session_scores_in_valid_range(self, base_url: str, e2e_pdf_bytes: bytes):
        """8축 점수가 0~100 범위 내에 있거나 null(not_evaluated)이다."""
        agent = CandidateAgent(prompt_variant="v1")
        result = run_session(base_url, e2e_pdf_bytes, agent)

        for axis, score in result.scores.items():
            if score is not None:
                assert 0 <= score <= 100, f"{axis} 점수 범위 초과: {score}"


class TestFollowupIncluded:
    def test_session_may_include_followup(self, base_url: str, e2e_pdf_bytes: bytes):
        """세션이 완주되면 followup 여부와 무관하게 정상 결과를 반환한다.

        followup 발생은 LLM 판단에 따라 비결정적이므로 발생 여부를 강제 검증하지 않는다.
        대신 turn_count >= 5 조건만 확인한다.
        """
        agent = CandidateAgent(prompt_variant="v1")
        result = run_session(base_url, e2e_pdf_bytes, agent)
        assert result.turn_count >= 5
        print(f"\n총 턴 수: {result.turn_count} (followup 포함 가능)")


class TestABComparison:
    def test_ab_comparison_produces_report(self, base_url: str, e2e_pdf_bytes: bytes):
        """v1/v2 프롬프트 각 1회 실행 후 비교 리포트를 출력한다."""
        results = []
        for variant in ["v1", "v2"]:
            agent = CandidateAgent(prompt_variant=variant)
            result = run_session(base_url, e2e_pdf_bytes, agent)
            results.append(result)
            save_result(result, _RESULTS_DIR)
            print(f"\n[{variant}] 총점: {result.total_score}, 턴: {result.turn_count}")

        assert len(results) == 2
        stats = compute_stats(results)
        print_report(stats)

        # 두 결과 모두 유효한 점수 보유
        for r in results:
            assert r.total_score >= 0
            for axis in AXIS_KEYS:
                assert axis in r.scores


class TestMultipleRunsStats:
    def test_three_runs_compute_stats(self, base_url: str, e2e_pdf_bytes: bytes):
        """동일 variant 3회 실행 후 mean/std 통계를 계산한다.

        비용 주의: 약 30턴 × 2 LLM 호출 발생.
        """
        results = []
        agent_v1 = CandidateAgent(prompt_variant="v1")

        for i in range(3):
            result = run_session(base_url, e2e_pdf_bytes, agent_v1)
            results.append(result)
            save_result(result, _RESULTS_DIR)
            print(f"\n[실행 {i + 1}/3] 총점: {result.total_score}")

        assert len(results) == 3

        stats = compute_stats(results)
        print_report(stats)

        # std가 계산되었는지 확인
        assert "total_score" in stats
        assert "mean" in stats["total_score"]
        assert "std" in stats["total_score"]
        assert stats["total_score"]["std"] >= 0.0
