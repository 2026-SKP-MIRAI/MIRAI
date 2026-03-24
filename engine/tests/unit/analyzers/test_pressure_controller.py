"""pressure_controller 단위 테스트."""
import pytest
from app.analyzers.text_analyzer import TextSignals
from app.analyzers.pressure_controller import calc_answer_quality, classify_pressure


def make_signals(**kwargs) -> TextSignals:
    defaults = dict(
        specificity_score=0.5, achievement_score=0.5, star_score=0.5,
        vague_ratio=0.01, agency_verb_count=1, cause_analysis_count=0,
        alternative_count=0, has_content=True, answer_length=100,
    )
    defaults.update(kwargs)
    return TextSignals(**defaults)


class TestCalcAnswerQuality:
    def test_known_values(self):
        s = make_signals(star_score=0.4, specificity_score=0.5, achievement_score=0.3)
        assert abs(calc_answer_quality(s) - 41.0) < 0.001

    def test_perfect_score(self):
        s = make_signals(star_score=1.0, specificity_score=1.0, achievement_score=1.0)
        assert calc_answer_quality(s) == pytest.approx(100.0)

    def test_zero_score(self):
        s = make_signals(star_score=0.0, specificity_score=0.0, achievement_score=0.0)
        assert calc_answer_quality(s) == pytest.approx(0.0)

    def test_boundary_exactly_60(self):
        s = make_signals(star_score=0.6, specificity_score=0.6, achievement_score=0.6)
        assert calc_answer_quality(s) == pytest.approx(60.0)


class TestClassifyPressure:
    def test_no_content_clarify(self):
        assert classify_pressure(make_signals(has_content=False)) == "CLARIFY"

    def test_high_vague_ratio_clarify(self):
        assert classify_pressure(make_signals(vague_ratio=0.05, agency_verb_count=2)) == "CLARIFY"

    def test_zero_agency_verb_clarify(self):
        assert classify_pressure(make_signals(vague_ratio=0.01, agency_verb_count=0)) == "CLARIFY"

    def test_low_quality_challenge(self):
        s = make_signals(star_score=0.3, specificity_score=0.2, achievement_score=0.1,
                         vague_ratio=0.01, agency_verb_count=1)
        assert classify_pressure(s) == "CHALLENGE"

    def test_good_answer_explore(self):
        s = make_signals(star_score=0.8, specificity_score=0.8, achievement_score=0.8,
                         vague_ratio=0.01, agency_verb_count=2)
        assert classify_pressure(s) == "EXPLORE"

    def test_vague_priority_over_quality(self):
        s = make_signals(star_score=0.1, specificity_score=0.1, achievement_score=0.1,
                         vague_ratio=0.05, agency_verb_count=1)
        assert classify_pressure(s) == "CLARIFY"

    def test_boundary_60_not_challenge(self):
        s = make_signals(star_score=0.6, specificity_score=0.6, achievement_score=0.6,
                         vague_ratio=0.01, agency_verb_count=1)
        assert classify_pressure(s) != "CHALLENGE"

    def test_deterministic(self):
        s = make_signals()
        assert len({classify_pressure(s) for _ in range(10)}) == 1
