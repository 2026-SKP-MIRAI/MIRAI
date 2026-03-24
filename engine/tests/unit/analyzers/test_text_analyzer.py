"""
tests/unit/analyzers/test_text_analyzer.py

TextSignals 결정론·경계값·각 점수 함수 단위 테스트.
외부 의존성 없음 (LLM 미사용).
"""

import pytest
from app.analyzers.text_analyzer import analyze, TextSignals


# ── 결정론(Determinism) ───────────────────────────────────────────────────────

class TestDeterminism:
    """동일 입력 → 동일 출력 불변식"""

    def test_same_text_5_calls_returns_identical_signals(self):
        text = "3개월 동안 매주 20시간씩 학습하여 팀 프로젝트를 완성했습니다."
        results = [analyze(text) for _ in range(5)]
        first = results[0]
        for r in results[1:]:
            assert r == first

    def test_different_texts_differ(self):
        a = analyze("매주 20시간씩 3개월 학습했습니다. 팀 성과를 30% 향상시켰습니다.")
        b = analyze("항상 열심히 노력했습니다. 다양한 경험을 통해 성장했습니다. 많은 것을 배웠습니다.")
        assert a != b

    def test_frozen_dataclass_raises_on_mutation(self):
        s = analyze("저는 직접 구현하고 설계하여 팀을 이끌었습니다. 결과적으로 30% 성과를 달성했습니다.")
        with pytest.raises(AttributeError):
            s.star_score = 1.0  # type: ignore[misc]


# ── has_content / answer_length ──────────────────────────────────────────────

class TestHasContent:
    def test_empty_string_has_no_content(self):
        s = analyze("")
        assert s.has_content is False
        assert s.answer_length == 0

    def test_whitespace_only_has_no_content(self):
        s = analyze("   \n\t  ")
        assert s.has_content is False

    def test_text_under_threshold_has_no_content(self):
        s = analyze("짧은 답변입니다. 너무 짧아서 분석하기 어렵습니다.")  # 26자, 50 미만
        assert s.has_content is False

    def test_empty_returns_all_zero_scores(self):
        s = analyze("")
        assert s.specificity_score == 0.0
        assert s.achievement_score == 0.0
        assert s.star_score == 0.0
        assert s.vague_ratio == 0.0
        assert s.agency_verb_count == 0
        assert s.cause_analysis_count == 0
        assert s.alternative_count == 0

    def test_sufficient_text_has_content(self):
        s = analyze("저는 3년간 백엔드 개발을 담당했으며 팀의 성과를 이끌었습니다. 다양한 프로젝트를 수행했습니다.")
        assert s.has_content is True
        assert s.answer_length > 0

    def test_answer_length_excludes_leading_trailing_whitespace(self):
        s1 = analyze("저는 팀을 이끌어 성과를 달성했습니다. 직접 구현하고 설계했습니다.")
        s2 = analyze("  저는 팀을 이끌어 성과를 달성했습니다. 직접 구현하고 설계했습니다.  ")
        assert s1.answer_length == s2.answer_length


# ── specificity_score ────────────────────────────────────────────────────────

class TestSpecificityScore:
    def test_no_numbers_returns_zero(self):
        text = "저는 열심히 노력하여 팀 프로젝트를 성공적으로 완료했습니다. 다양한 경험을 통해 성장했습니다."
        s = analyze(text)
        assert s.specificity_score == 0.0

    def test_with_percentage_returns_positive(self):
        text = "API 응답 시간을 30% 단축했습니다. 팀 성과를 50% 향상시켰으며 3개월 만에 목표를 달성했습니다."
        s = analyze(text)
        assert s.specificity_score > 0.0

    def test_score_capped_at_1(self):
        text = "30% 향상, 50명 팀원, 3개월 기간, 100만원 절감, 2위 달성, 5배 증가, 2024년 기준"
        s = analyze(text)
        assert s.specificity_score <= 1.0

    def test_3_or_more_patterns_returns_full_score(self):
        text = "3개월간 팀 20명을 이끌어 100% 달성하였고 이후 50% 절감했습니다. 추가로 2위를 기록했습니다."
        s = analyze(text)
        assert s.specificity_score == pytest.approx(1.0)

    def test_score_between_0_and_1(self):
        text = "저는 30% 향상을 달성했습니다. 이 결과로 팀 성과가 개선되었습니다. 많은 노력이 필요했습니다."
        s = analyze(text)
        assert 0.0 <= s.specificity_score <= 1.0


# ── achievement_score ────────────────────────────────────────────────────────

class TestAchievementScore:
    def test_no_achievement_pattern_returns_zero(self):
        text = "저는 팀 프로젝트를 완료했습니다. 업무를 수행하며 성장했습니다. 많은 것을 배웠습니다."
        s = analyze(text)
        assert s.achievement_score == 0.0

    def test_achievement_with_number_returns_positive(self):
        text = "비용을 30% 절감하고 성과를 50% 향상시켰습니다. 또한 100명 달성하는 성과를 올렸습니다."
        s = analyze(text)
        assert s.achievement_score > 0.0

    def test_score_capped_at_1(self):
        text = "비용 30% 절감, 성과 50% 향상, 건수 100건 달성, 매출 200% 증가했습니다."
        s = analyze(text)
        assert s.achievement_score <= 1.0


# ── star_score ───────────────────────────────────────────────────────────────

class TestStarScore:
    def test_empty_returns_zero(self):
        s = analyze("")
        assert s.star_score == 0.0

    def test_all_star_elements_returns_one(self):
        text = (
            "당시 팀에서 API 성능 개선 과제가 주어졌습니다. "
            "목표는 응답시간 단축이었고, "
            "직접 구현했고 분석하여 실행했습니다. "
            "결과적으로 성과를 달성하고 향상시켰습니다."
        )
        s = analyze(text)
        assert s.star_score == pytest.approx(1.0)

    def test_action_only_returns_0_4(self):
        # Action 가중치 2/5 = 0.4 (S/T/R 키워드 없이 Action 키워드만 포함)
        text = "저는 직접 시스템 아키텍처를 구현했고 신규 기능을 개발했으며 스스로 배포 프로세스를 실행했습니다."
        s = analyze(text)
        assert s.star_score == pytest.approx(0.4, abs=0.01)

    def test_no_keywords_returns_zero(self):
        text = "저는 업무를 수행하였으며 일을 완수했습니다. 그 과정에서 많은 것을 배웠습니다."
        s = analyze(text)
        assert s.star_score == 0.0

    def test_score_between_0_and_1(self):
        text = "당시 팀에서 프로젝트를 진행했습니다. 결과적으로 성과가 있었습니다."
        s = analyze(text)
        assert 0.0 <= s.star_score <= 1.0


# ── vague_ratio ──────────────────────────────────────────────────────────────

class TestVagueRatio:
    def test_no_vague_words_returns_zero(self):
        text = "3개월간 20명의 팀을 이끌어 목표를 달성했습니다. API 성능을 개선했습니다."
        s = analyze(text)
        assert s.vague_ratio == 0.0

    def test_many_vague_words_returns_high_ratio(self):
        text = "항상 열심히 노력하여 다양한 경험으로 많은 것을 배웠습니다. 적극적으로 최선을 다했습니다."
        s = analyze(text)
        assert s.vague_ratio > 0.3

    def test_ratio_between_0_and_1(self):
        text = "저는 항상 팀에서 열심히 노력하여 30% 개선을 달성했습니다."
        s = analyze(text)
        assert 0.0 <= s.vague_ratio <= 1.0


# ── agency_verb_count ────────────────────────────────────────────────────────

class TestAgencyVerbCount:
    def test_no_agency_verbs_returns_zero(self):
        text = "저는 업무를 수행하였으며 일을 했습니다. 그 과정에서 많은 것을 배웠습니다."
        s = analyze(text)
        assert s.agency_verb_count == 0

    def test_agency_verb_stems_matched(self):
        # "설계하" + "구현하" + "이끌" stems 포함
        text = "저는 직접 시스템을 설계하고 구현하여 팀을 이끌었습니다. 또한 프로세스를 개선하고 실행했습니다."
        s = analyze(text)
        assert s.agency_verb_count >= 3

    def test_repeated_verb_counted_multiple_times(self):
        text = "저는 분석하여 분석한 결과를 제안하고 또 분석했습니다. 팀을 직접 이끌어 목표를 달성했습니다."
        s = analyze(text)
        assert s.agency_verb_count >= 3


# ── cause_analysis_count / alternative_count ─────────────────────────────────

class TestCauseAndAlternative:
    def test_no_cause_returns_zero(self):
        text = "저는 팀 프로젝트를 완료했습니다. 다양한 경험을 통해 성장했습니다. 많은 것을 배웠습니다."
        s = analyze(text)
        assert s.cause_analysis_count == 0

    def test_cause_words_counted(self):
        text = "원인을 분석한 결과 문제를 파악했고, 왜냐하면 데이터가 부족했기 때문에 조사한 결과를 기반으로 해결했습니다."
        s = analyze(text)
        assert s.cause_analysis_count >= 2

    def test_no_alternative_returns_zero(self):
        text = "저는 팀 프로젝트를 완료했습니다. 다양한 경험을 통해 성장했습니다."
        s = analyze(text)
        assert s.alternative_count == 0

    def test_alternative_words_counted(self):
        text = "대안으로 비교 분석을 진행했으며 여러 장단점을 비교하여 최적의 방법을 신중히 선택했습니다."
        s = analyze(text)
        assert s.alternative_count >= 2
