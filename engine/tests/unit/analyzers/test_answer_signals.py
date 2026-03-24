"""answer_signals 단위 테스트."""
import pytest
from app.analyzers.text_analyzer import TextSignals
from app.analyzers.answer_signals import format_persona_signals


def make_signals(**kwargs) -> TextSignals:
    defaults = dict(
        specificity_score=0.5, achievement_score=0.5, star_score=0.5,
        vague_ratio=0.01, agency_verb_count=2, cause_analysis_count=1,
        alternative_count=1, has_content=True, answer_length=100,
    )
    defaults.update(kwargs)
    return TextSignals(**defaults)


class TestFormatPersonaSignals:
    def test_hr_signal_text(self):
        result = format_persona_signals("팀과 협업하여 소통했습니다", make_signals(), "hr")
        assert "HR 관심 신호" in result
        assert "협업/소통 키워드 밀도" in result

    def test_tech_signal_text(self):
        result = format_persona_signals("아키텍처를 설계하고 최적화했습니다", make_signals(), "tech_lead")
        assert "기술팀장 관심 신호" in result
        assert "기술 깊이 키워드 밀도" in result

    def test_exec_signal_text(self):
        result = format_persona_signals("매출 30% 성장의 임팩트를 달성했습니다", make_signals(), "executive")
        assert "경영진 관심 신호" in result
        assert "비즈니스 임팩트 키워드 밀도" in result

    def test_different_personas_different_output(self):
        answer = "협업 설계 매출"
        s = make_signals()
        results = [format_persona_signals(answer, s, p) for p in ["hr", "tech_lead", "executive"]]
        assert len(set(results)) == 3

    def test_empty_answer_no_error(self):
        result = format_persona_signals("", make_signals(has_content=False, answer_length=0), "hr")
        assert isinstance(result, str)

    def test_deterministic(self):
        answer = "협업하여 성과를 달성했습니다"
        s = make_signals()
        results = [format_persona_signals(answer, s, "hr") for _ in range(5)]
        assert len(set(results)) == 1
