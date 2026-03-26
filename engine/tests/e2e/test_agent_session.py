"""E2E 통합 테스트 — 실제 LLM + 실제 엔진 서버 대상.

실행 조건: RUN_E2E_AGENT=true 환경변수 설정 + 엔진 서버 구동 중
비용 발생 주의: 단일 세션 약 10턴 × 2 LLM 호출
"""
from __future__ import annotations

from tests.e2e.agent import CandidateAgent
from tests.e2e.reporter import AXIS_KEYS, compute_stats, print_report, save_result
from tests.e2e.runner import RESULTS_DIR, format_feedback, run_session


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


class TestFeedbackLoop:
    def test_feedback_loop_completes(self, base_url: str, e2e_pdf_bytes: bytes):
        """피드백을 반영한 2회차 세션이 정상 완주되고 점수 delta가 출력된다.

        흐름:
            세션 1 (피드백 없음) → axisFeedbacks 추출
            세션 2 (피드백 주입) → 새 점수
            delta 출력 (LLM 비결정적 — 향상 여부 hard assert 안 함)
        """
        # 세션 1: 피드백 없는 기준 세션
        agent1 = CandidateAgent(prompt_variant="v1")
        result1 = run_session(base_url, e2e_pdf_bytes, agent1)
        save_result(result1, _RESULTS_DIR)
        print(f"\n[세션 1] 총점: {result1.total_score}, 턴: {result1.turn_count}")

        assert result1.feedback, "세션 1 axisFeedbacks가 비어있습니다."

        # 피드백 텍스트 변환
        feedback_text = format_feedback(result1.feedback)
        assert feedback_text

        # 세션 2: 피드백 주입
        agent2 = CandidateAgent(prompt_variant="v1", prior_feedback=feedback_text)
        result2 = run_session(base_url, e2e_pdf_bytes, agent2)
        save_result(result2, _RESULTS_DIR)
        print(f"\n[세션 2] 총점: {result2.total_score}, 턴: {result2.turn_count}")

        delta = result2.total_score - result1.total_score
        sign = "+" if delta >= 0 else ""
        print(f"\n점수 변화 (세션 1 → 세션 2): {sign}{delta}")

        if result1.summary:
            print(f"\n[세션 1 총평] {result1.summary}")

        if result1.feedback:
            print("\n[세션 1 축별 피드백]")
            for item in result1.feedback:
                label = item.get("axisLabel", item.get("axis", ""))
                score = item.get("score")
                fb_type = item.get("type", "")
                fb_text = item.get("feedback", "")
                score_str = f"{score}점" if score is not None else "미평가"
                print(f"  {label} ({score_str}, {fb_type}): {fb_text}")

        # 방법 1 — 피드백이 실제로 LLM 프롬프트에 포함됐는지 검증
        assert agent2.prompt_log, "세션 2에서 프롬프트가 기록되지 않았습니다."
        assert any(
            feedback_text in prompt for prompt in agent2.prompt_log
        ), "세션 2 프롬프트에 피드백 텍스트가 포함되지 않았습니다."

        # 방법 2 — 세션 2 실제 답변 출력 (사람이 눈으로 확인)
        print("\n[세션 2 실제 답변 — 피드백 반영 여부를 직접 확인하세요]")
        for i, item in enumerate(result2.history, 1):
            print(f"\n  Q{i} ({item.get('personaLabel', '')}): {item.get('question', '')}")
            print(f"  A{i}: {item.get('answer', '')}")

        # 세션 완주 및 유효 점수 범위 검증
        assert result2.turn_count >= 5
        assert 0 <= result2.total_score <= 100


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
