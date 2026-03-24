# 03. E2E 테스트 플랜 — 규칙 기반 텍스트 분석 엔진

> 이슈 #197: 규칙 기반 텍스트 분석 엔진 (pytest 커버리지 80% 이상 달성 필수)

---

## 실제 결과 (2026-03-24 기준)

### 테스트 실행 결과

```
234 passed, 4 skipped, 1 warning
```

| 레이어 | 파일 | 테스트 수 |
|--------|------|-----------|
| Unit / Analyzers | `tests/unit/analyzers/test_text_analyzer.py` | 32개 |
| Unit / Services | `tests/unit/services/test_report_service.py` | 21개 |
| Unit / Services | `tests/unit/services/test_interview_service.py` | 기존 유지 + 1개 수정 |
| Integration | `tests/integration/test_report_router.py` | 확장 포함 |
| Integration | `tests/integration/test_interview_router.py` | 확장 포함 4개 추가 |

### 실제 커버리지

| 파일 | 목표 | 실제 |
|------|------|------|
| `app/analyzers/text_analyzer.py` | 95%+ | **98%** |
| `app/analyzers/keywords.py` | — | **100%** |
| `app/services/report_service.py` | 90%+ | **96%** |
| `app/routers/report.py` | 85%+ | **100%** |
| `app/routers/interview.py` | 85%+ | **100%** |
| `app/schemas.py` | — | **100%** |
| **전체** | **80%+** | **93.54%** ✅ |

### 실제 테스트 케이스 — test_text_analyzer.py (32개)

| 클래스 | 테스트 | 검증 내용 |
|--------|--------|-----------|
| `TestDeterminism` (3) | `test_same_text_5_calls_returns_identical_signals` | 동일 입력 5회 → 동일 TextSignals |
| | `test_different_texts_differ` | 다른 텍스트 → 다른 결과 |
| | `test_frozen_dataclass_raises_on_mutation` | frozen dataclass 불변성 |
| `TestHasContent` (6) | `test_empty_string_has_no_content` | 빈 문자열 → has_content=False |
| | `test_whitespace_only_has_no_content` | 공백만 → False |
| | `test_text_under_threshold_has_no_content` | 26자 → False (임계값 50) |
| | `test_empty_returns_all_zero_scores` | 빈 문자열 → 전 점수 0 |
| | `test_sufficient_text_has_content` | 55자+ → has_content=True |
| | `test_answer_length_excludes_leading_trailing_whitespace` | strip 후 길이 동일 |
| `TestSpecificityScore` (5) | 수치 없음=0, % 포함>0, 3개+ =1.0, 상한=1.0, 0~1 범위 | |
| `TestAchievementScore` (3) | 성과 패턴 없음=0, 수치+성과>0, 상한=1.0 | |
| `TestStarScore` (5) | 빈문자열=0, S+T+A+R=1.0, Action만=0.4, 키워드없음=0, 0~1 범위 | |
| `TestVagueRatio` (3) | 모호 표현 없음=0, 과다>0.3, 0~1 범위 | |
| `TestAgencyVerbCount` (3) | 없음=0, 어간 매칭 ≥3, 반복 카운트 | |
| `TestCauseAndAlternative` (4) | 원인 없음=0, 원인 카운트 ≥2, 대안 없음=0, 대안 카운트 ≥2 | |

### 신규 추가 — not_evaluated 관련 (test_report_service.py)

| 테스트 | 검증 내용 |
|--------|-----------|
| `test_generate_report_not_evaluated_when_all_answers_empty` | 빈 답변 → 전 축 not_evaluated |
| `test_generate_report_not_evaluated_excluded_from_total_score` | not_evaluated 축 → totalScore=0 |
| `test_generate_report_signals_field_included_when_has_content` | has_content 시 signals 포함 확인 |
| `test_generate_report_rubric_scores_are_deterministic` | 동일 입력 3회 → 동일 점수 (결정론) |
| `test_axis_scores_accepts_none` | AxisScores nullable 스키마 검증 |
| `test_axis_feedback_accepts_not_evaluated_type` | FeedbackType "not_evaluated" 검증 |

### 신규 추가 — Integration (test_report_router.py)

| 테스트 | 검증 내용 |
|--------|-----------|
| `test_generate_report_200_signals_field_included` | HTTP 응답에 signals 필드 존재 |
| `test_generate_report_200_not_evaluated_when_all_empty` | 빈 답변 히스토리 → 전 축 not_evaluated |
| `test_generate_report_200_not_evaluated_excluded_from_total_score` | not_evaluated 제외 totalScore |

### 주요 변경사항 (플랜 대비)

- `tests/fixtures/sample_answers_*.json` 3개 → **미생성**: 테스트가 인라인 데이터로 충분히 커버되어 별도 픽스처 불필요 판단
- `test_followup_type_parses_llm_output` 파라미터 테스트 → **수정**: followupType이 규칙 기반으로 변경되어 LLM 응답값 무시 동작 검증으로 재작성
- `HAS_CONTENT_MIN_CHARS` 20 → 50 변경으로 테스트 텍스트 길이 조정 필요 (5개 테스트 텍스트 수정)

---

## 1. 테스트 전략 개요

### 테스트 피라미드

```
        ┌─────────────────┐
        │  Integration     │  ← 라우터 레벨 HTTP 테스트 (신규 signals/not_evaluated 검증)
        │  (확장)          │
        ├─────────────────┤
        │  Unit: Services  │  ← report_service 변경분 (not_evaluated, signals 필드)
        │  (확장)          │
        ├─────────────────┤
        │  Unit: Analyzers │  ← text_analyzer.py 핵심 로직 (신규)
        │  (신규)          │
        └─────────────────┘
```

### 각 레이어 목적

| 레이어 | 목적 | 격리 수준 |
|--------|------|-----------|
| Unit / Analyzers | `analyze()` 함수의 결정론·경계값 검증 | 완전 격리 (외부 의존 없음) |
| Unit / Services | `report_service` not_evaluated 분기·signals 포함 검증 | LLM mock |
| Integration | HTTP 엔드포인트에서 signals 필드 포함·not_evaluated totalScore 계산 검증 | LLM mock, FastAPI TestClient |

### 커버리지 목표

| 파일 | 목표 커버리지 | 실제 | 주요 분기 |
|------|---------------|------|-----------|
| `app/analyzers/text_analyzer.py` | 95%+ | **98%** ✅ | 빈 문자열, 각 패턴 매칭 분기 |
| `app/services/report_service.py` | 90%+ | **96%** ✅ | not_evaluated 분기, signals 조합 |
| `app/routers/report.py` | 85%+ | **100%** ✅ | 200/400/422/500 분기 |
| `app/routers/interview.py` | 85%+ | **100%** ✅ | followup 타입 분기 |
| 전체 | **80%+** | **93.54%** ✅ | — |

---

## 2. 신규/확장 테스트 파일 목록

| 파일 경로 | 신규/확장 | 목적 |
|-----------|-----------|------|
| `engine/tests/unit/analyzers/__init__.py` | 신규 | 패키지 초기화 |
| `engine/tests/unit/analyzers/test_text_analyzer.py` | 신규 | TextSignals 결정론·경계값·각 점수 함수 |
| `engine/tests/unit/services/test_report_service.py` | 확장 | not_evaluated 분기, signals 필드 포함 검증 |
| `engine/tests/integration/test_report_router.py` | 확장 | signals 필드·not_evaluated totalScore HTTP 검증 |
| `engine/tests/integration/test_interview_router.py` | 확장 | followup 타입별 결정론 검증 (텍스트 신호 기반) |
| `engine/tests/fixtures/sample_answers_not_evaluated.json` | 신규 | has_content=False 케이스 포함 히스토리 |
| `engine/tests/fixtures/sample_answers_high_score.json` | 신규 | 고득점 패턴 (STAR 완성 + 수치 포함) |
| `engine/tests/fixtures/sample_answers_low_score.json` | 신규 | 저득점 패턴 (모호 표현 + 수치 없음) |

---

## 3. test_text_analyzer.py — 전체 테스트 케이스

파일 경로: `engine/tests/unit/analyzers/test_text_analyzer.py`

### 3.1 결정론(Determinism) 테스트

**목적:** 동일 입력에 대해 항상 동일한 TextSignals를 반환하는지 검증.
규칙 기반 엔진은 LLM을 사용하지 않으므로, 같은 텍스트를 여러 번 호출해도 결과가 동일해야 한다.

```python
# Given/When/Then 포맷

class TestDeterminism:
    """동일 입력 → 동일 출력 불변식"""

    def test_same_text_5_calls_returns_identical_signals(self):
        # Given
        text = "3개월 동안 매주 20시간씩 학습하여 팀 프로젝트를 완성했습니다."
        # When
        results = [analyze(text) for _ in range(5)]
        # Then
        first = results[0]
        for r in results[1:]:
            assert r.specificity_score == first.specificity_score
            assert r.star_score == first.star_score
            assert r.vague_ratio == first.vague_ratio
            assert r.agency_verb_count == first.agency_verb_count

    def test_different_texts_may_differ(self):
        # Given
        text_a = "매주 20시간씩 3개월 학습했습니다."
        text_b = "열심히 공부했습니다."
        # When
        signals_a = analyze(text_a)
        signals_b = analyze(text_b)
        # Then — 적어도 한 필드는 달라야 함
        assert signals_a != signals_b
```

### 3.2 specificity_score 테스트

**목적:** 수치 표현 유무에 따라 점수가 달라지는지 검증.

```python
class TestSpecificityScore:
    """수치 구체성 점수 (숫자·단위 패턴 감지)"""

    def test_numeric_expression_increases_score(self):
        # Given
        text = "매주 20시간씩 3개월 동안 학습했습니다."
        # When
        signals = analyze(text)
        # Then
        assert signals.specificity_score > 0

    def test_vague_text_has_zero_specificity(self):
        # Given
        text = "열심히 공부했습니다."
        # When
        signals = analyze(text)
        # Then
        assert signals.specificity_score == 0.0

    def test_multiple_numeric_expressions_increase_score(self):
        # Given
        text = "30% 향상, 5명 팀 리더, 2주 안에 완성했습니다."
        # When
        signals = analyze(text)
        # Then
        assert signals.specificity_score > 0

    def test_percentage_is_counted_as_specific(self):
        # Given
        text = "성능을 40% 개선했습니다."
        # When
        signals = analyze(text)
        # Then
        assert signals.specificity_score > 0

    def test_empty_string_has_zero_specificity(self):
        # Given
        text = ""
        # When
        signals = analyze(text)
        # Then
        assert signals.specificity_score == 0.0
```

### 3.3 star_score 테스트

**목적:** STAR 구조(Situation, Task, Action, Result) 완성도 점수 검증.

```python
class TestStarScore:
    """STAR 구조 점수 (4개 요소 가중 합산)"""

    SITUATION_KEYWORD = "상황은"    # Situation 트리거
    TASK_KEYWORD = "과제는"         # Task 트리거
    ACTION_KEYWORD = "제가 직접"    # Action 트리거 (2배 가중)
    RESULT_KEYWORD = "결과적으로"   # Result 트리거

    def test_all_star_components_gives_full_score(self):
        # Given — S, T, A(가중치 높음), R 모두 포함
        text = (
            "상황은 팀 성과가 저조했습니다. "
            "과제는 프로세스 개선이었습니다. "
            "제가 직접 워크플로우를 재설계했습니다. "
            "결과적으로 생산성이 30% 향상됐습니다."
        )
        # When
        signals = analyze(text)
        # Then
        assert signals.star_score == 1.0

    def test_only_situation_and_task_gives_partial_score(self):
        # Given — S, T만 포함 (Action 가중치 2배로 인해 낮음)
        text = "상황은 팀 인원이 부족했습니다. 과제는 추가 인원 확보였습니다."
        # When
        signals = analyze(text)
        # Then
        assert 0.3 < signals.star_score < 0.7

    def test_empty_string_gives_zero_star_score(self):
        # Given
        text = ""
        # When
        signals = analyze(text)
        # Then
        assert signals.star_score == 0.0

    def test_action_only_gives_some_score(self):
        # Given — Action만 포함 (가중치 높으므로 적당한 점수)
        text = "제가 직접 코드를 리팩터링하여 문제를 해결했습니다."
        # When
        signals = analyze(text)
        # Then
        assert 0.0 < signals.star_score < 1.0

    def test_star_score_between_0_and_1(self):
        # Given — 임의 텍스트
        texts = [
            "아무 내용이나 있습니다.",
            "상황은 x. 과제는 y. 제가 직접 z. 결과적으로 w.",
            "",
        ]
        for text in texts:
            signals = analyze(text)
            # Then
            assert 0.0 <= signals.star_score <= 1.0, f"star_score 범위 위반: {signals.star_score} ('{text}')"
```

### 3.4 vague_ratio 테스트

**목적:** 모호 표현 비율이 텍스트 내용에 따라 정확히 계산되는지 검증.

```python
class TestVagueRatio:
    """모호 표현 비율 (모호 단어 수 / 전체 단어 수)"""

    def test_highly_vague_text_has_high_ratio(self):
        # Given — 모호 표현 밀집 텍스트
        text = "항상 최선을 다해 열심히 노력했습니다."
        # When
        signals = analyze(text)
        # Then
        assert signals.vague_ratio > 0.3

    def test_specific_text_has_low_vague_ratio(self):
        # Given — 수치·원인 기반 구체적 텍스트
        text = "분석 결과 3가지 원인을 도출했습니다."
        # When
        signals = analyze(text)
        # Then
        assert signals.vague_ratio < 0.1

    def test_mixed_text_has_intermediate_ratio(self):
        # Given — 구체적 내용 + 모호 표현 혼합
        text = "열심히 노력했고, 3개월 동안 매일 2시간씩 공부했습니다."
        # When
        signals = analyze(text)
        # Then
        assert 0.0 <= signals.vague_ratio <= 1.0

    def test_empty_text_has_zero_vague_ratio(self):
        # Given
        text = ""
        # When
        signals = analyze(text)
        # Then
        assert signals.vague_ratio == 0.0

    def test_vague_ratio_between_0_and_1(self):
        # Given
        text = "어쩐지 뭔가 잘 됐습니다. 노력했고, 최선을 다했습니다."
        # When
        signals = analyze(text)
        # Then
        assert 0.0 <= signals.vague_ratio <= 1.0
```

### 3.5 agency_verb_count 테스트

**목적:** 주도성 동사(제안, 이끌, 주도, 설계 등) 개수 계산 검증.

```python
class TestAgencyVerbCount:
    """주도성 동사 개수 (능동적 행위 표현 감지)"""

    def test_active_leadership_text_has_high_count(self):
        # Given — 주도성 동사 다수 포함
        text = "제가 직접 제안하여 팀을 이끌었습니다."
        # When
        signals = analyze(text)
        # Then
        assert signals.agency_verb_count >= 2

    def test_passive_text_has_zero_agency(self):
        # Given — 수동적 표현 (주도성 없음)
        text = "회사에서 시켰습니다."
        # When
        signals = analyze(text)
        # Then
        assert signals.agency_verb_count == 0

    def test_multiple_agency_verbs_all_counted(self):
        # Given — 설계, 구현, 개선, 제안 등 다수 포함
        text = "시스템을 설계하고, 코드를 구현했으며, 프로세스를 개선했습니다."
        # When
        signals = analyze(text)
        # Then
        assert signals.agency_verb_count >= 3

    def test_empty_text_has_zero_agency(self):
        # Given
        text = ""
        # When
        signals = analyze(text)
        # Then
        assert signals.agency_verb_count == 0
```

### 3.6 has_content 테스트

**목적:** 내용 존재 여부 판별 로직 검증 (빈 문자열, 공백, 짧은 텍스트).

```python
class TestHasContent:
    """답변 존재 여부 (10자 이상이어야 True)"""

    def test_empty_string_is_no_content(self):
        # Given
        text = ""
        # When
        signals = analyze(text)
        # Then
        assert signals.has_content is False

    def test_whitespace_only_is_no_content(self):
        # Given
        text = "   "
        # When
        signals = analyze(text)
        # Then
        assert signals.has_content is False

    def test_short_text_under_10_chars_is_no_content(self):
        # Given — 9자 (공백 제외 9자)
        text = "짧은답변입"  # 5자
        # When
        signals = analyze(text)
        # Then
        assert signals.has_content is False

    def test_normal_text_is_content(self):
        # Given — 충분한 길이의 정상 텍스트
        text = "팀 프로젝트에서 리더 역할을 맡아 성공적으로 완료했습니다."
        # When
        signals = analyze(text)
        # Then
        assert signals.has_content is True

    def test_exactly_10_chars_is_content(self):
        # Given — 정확히 10자
        text = "1234567890"
        # When
        signals = analyze(text)
        # Then
        assert signals.has_content is True
```

### 3.7 answer_length 테스트

```python
class TestAnswerLength:
    """글자 수 (공백 포함 len() 또는 strip 후 len())"""

    def test_empty_string_length_is_zero(self):
        signals = analyze("")
        assert signals.answer_length == 0

    def test_length_matches_input(self):
        text = "열 글자입니다."  # 8자
        signals = analyze(text)
        assert signals.answer_length == len(text.strip())
```

### 3.8 cause_analysis_count / alternative_count 테스트

```python
class TestCauseAndAlternative:
    """원인 분석 / 대안 고려 표현 개수"""

    def test_cause_analysis_expressions_counted(self):
        # Given — 원인 분석 표현 포함
        text = "원인을 분석한 결과, 왜냐하면 프로세스가 비효율적이었기 때문입니다."
        signals = analyze(text)
        assert signals.cause_analysis_count >= 1

    def test_alternative_expressions_counted(self):
        # Given — 대안 고려 표현 포함
        text = "다른 방법으로는 A와 B가 있었지만, 대신 C를 선택했습니다."
        signals = analyze(text)
        assert signals.alternative_count >= 1

    def test_no_cause_or_alternative_in_simple_text(self):
        text = "열심히 했습니다."
        signals = analyze(text)
        assert signals.cause_analysis_count == 0
        assert signals.alternative_count == 0
```

---

## 4. report_service 테스트 확장 케이스

파일 경로: `engine/tests/unit/services/test_report_service.py` (기존 파일에 추가)

### 4.1 not_evaluated 처리 테스트

```python
# ── not_evaluated 처리 ────────────────────────────────────────────────────────

def test_generate_report_empty_answer_axis_is_not_evaluated():
    """has_content=False인 축 → score=None, type='not_evaluated'"""
    # Given — 빈 답변이 포함된 히스토리
    history_data = json.loads(
        (FIXTURES_PATH / "sample_answers_not_evaluated.json").read_text(encoding="utf-8")
    )
    history = [HistoryItem(**item) for item in history_data]

    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_REPORT_JSON)):
        from app.services.report_service import generate_report
        result, _ = generate_report("이력서", history)

    # Then — not_evaluated 축은 score가 None
    not_evaluated = [fb for fb in result.axisFeedbacks if fb.type == "not_evaluated"]
    for fb in not_evaluated:
        assert fb.score is None, f"{fb.axis} not_evaluated이지만 score={fb.score}"


def test_generate_report_not_evaluated_excluded_from_total_score():
    """not_evaluated 제외 후 나머지 축 평균으로 totalScore 계산"""
    # Given
    history_data = json.loads(
        (FIXTURES_PATH / "sample_answers_not_evaluated.json").read_text(encoding="utf-8")
    )
    history = [HistoryItem(**item) for item in history_data]

    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_REPORT_JSON)):
        from app.services.report_service import generate_report
        result, _ = generate_report("이력서", history)

    # Then — totalScore는 평가된 축 점수들의 평균
    evaluated = [fb for fb in result.axisFeedbacks if fb.type != "not_evaluated"]
    if evaluated:
        expected_total = round(sum(fb.score for fb in evaluated) / len(evaluated))
        assert abs(result.totalScore - expected_total) <= 1  # 반올림 오차 허용


def test_generate_report_all_not_evaluated_total_score_is_zero():
    """모든 축이 not_evaluated → totalScore == 0"""
    # Given — 모든 답변이 빈 히스토리
    empty_history = [
        HistoryItem(persona="hr", personaLabel="HR", question=f"질문{i}", answer="")
        for i in range(5)
    ]
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_REPORT_JSON)):
        from app.services.report_service import generate_report
        result, _ = generate_report("이력서", empty_history)

    assert result.totalScore == 0
```

### 4.2 signals 필드 포함 테스트

```python
def test_generate_report_response_contains_signals():
    """ReportResponse에 signals 필드가 포함되어야 함"""
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_REPORT_JSON)):
        from app.services.report_service import generate_report
        result, _ = generate_report("이력서 내용", make_history(5))

    # Then — signals 필드 존재
    assert hasattr(result, "signals"), "ReportResponse에 signals 필드가 없습니다"
    assert result.signals is not None


def test_generate_report_signals_has_expected_structure():
    """signals는 각 질문에 대한 TextSignals 리스트여야 함"""
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_REPORT_JSON)):
        from app.services.report_service import generate_report
        result, _ = generate_report("이력서 내용", make_history(5))

    signals = result.signals
    # 각 히스토리 항목마다 signals가 생성됨
    assert len(signals) == 5
    for s in signals:
        assert hasattr(s, "specificity_score")
        assert hasattr(s, "star_score")
        assert hasattr(s, "vague_ratio")
        assert hasattr(s, "has_content")
        assert hasattr(s, "agency_verb_count")


def test_generate_report_signals_specificity_range():
    """signals의 specificity_score는 0.0 이상이어야 함"""
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(MOCK_REPORT_JSON)):
        from app.services.report_service import generate_report
        result, _ = generate_report("이력서 내용", make_history(5))

    for s in result.signals:
        assert s.specificity_score >= 0.0
        assert 0.0 <= s.star_score <= 1.0
        assert 0.0 <= s.vague_ratio <= 1.0
```

---

## 5. 통합 테스트 케이스

### 5.1 /api/report/generate 확장

파일 경로: `engine/tests/integration/test_report_router.py` (기존 파일에 추가)

```python
# ── signals 필드 포함 검증 ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_report_200_contains_signals_field():
    """정상 응답에 signals 필드 포함"""
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(MOCK_REPORT_JSON)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/report/generate", json=make_request_body(5))
    assert resp.status_code == 200
    data = resp.json()
    assert "signals" in data, "응답에 signals 필드가 없습니다"
    assert isinstance(data["signals"], list)
    assert len(data["signals"]) == 5  # 히스토리 5개


@pytest.mark.asyncio
async def test_generate_report_200_signals_has_expected_keys():
    """signals 항목에 필수 키가 모두 포함"""
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(MOCK_REPORT_JSON)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/report/generate", json=make_request_body(5))
    data = resp.json()
    required_keys = {
        "specificity_score", "achievement_score", "star_score",
        "vague_ratio", "agency_verb_count", "has_content", "answer_length"
    }
    for sig in data["signals"]:
        for key in required_keys:
            assert key in sig, f"signals 항목에 '{key}' 키 없음"


# ── not_evaluated 처리 검증 ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_report_200_short_answer_axis_is_not_evaluated():
    """짧은 답변이 있는 history → 해당 축 not_evaluated"""
    # Given — 마지막 항목에 빈 답변 포함
    history_with_empty = list(MOCK_HISTORY[:4]) + [{
        "persona": "hr",
        "personaLabel": "HR 담당자",
        "question": "마지막 질문",
        "answer": "",  # 빈 답변
    }]
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(MOCK_REPORT_JSON)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/report/generate", json={
                "resumeText": "이력서",
                "history": history_with_empty,
            })
    assert resp.status_code == 200
    data = resp.json()
    not_evaluated = [fb for fb in data["axisFeedbacks"] if fb["type"] == "not_evaluated"]
    assert len(not_evaluated) >= 1


@pytest.mark.asyncio
async def test_generate_report_200_not_evaluated_excluded_total_score():
    """not_evaluated 제외 totalScore 계산 검증"""
    history_with_empty = list(MOCK_HISTORY[:4]) + [{
        "persona": "hr",
        "personaLabel": "HR 담당자",
        "question": "마지막 질문",
        "answer": "",
    }]
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(MOCK_REPORT_JSON)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/report/generate", json={
                "resumeText": "이력서",
                "history": history_with_empty,
            })
    data = resp.json()
    # not_evaluated 제외 축의 평균 계산
    evaluated = [fb for fb in data["axisFeedbacks"] if fb["type"] != "not_evaluated" and fb["score"] is not None]
    if evaluated:
        expected = round(sum(fb["score"] for fb in evaluated) / len(evaluated))
        assert abs(data["totalScore"] - expected) <= 1
```

### 5.2 /api/interview/followup 확장

파일 경로: `engine/tests/integration/test_interview_router.py` (기존 파일에 추가)

```python
# ── followupType 텍스트 신호 기반 분기 검증 ──────────────────────────────────

CLARIFY_JSON = '{"shouldFollowUp": true, "followupType": "CLARIFY", "followupQuestion": "더 구체적으로 설명해 주세요.", "reasoning": "STAR 구조 미완성"}'
CHALLENGE_JSON = '{"shouldFollowUp": true, "followupType": "CHALLENGE", "followupQuestion": "그 성과의 근거는?", "reasoning": "구체적 성과 확인 필요"}'
EXPLORE_JSON = '{"shouldFollowUp": true, "followupType": "EXPLORE", "followupQuestion": "그 경험에서 무엇을 배웠나요?", "reasoning": "심층 탐색 적합"}'


@pytest.mark.asyncio
async def test_followup_clarify_for_vague_answer():
    """CLARIFY: STAR 미완성·모호한 답변 → CLARIFY 타입 반환"""
    # Given — 모호하고 구조 없는 답변
    vague_answer = "팀에서 열심히 노력했습니다."
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(CLARIFY_JSON)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/interview/followup", json={
                "question": "팀워크 경험을 말해주세요.",
                "answer": vague_answer,
                "persona": "hr",
                "resumeText": "이력서",
            })
    assert resp.status_code == 200
    data = resp.json()
    assert data["followupType"] == "CLARIFY"


@pytest.mark.asyncio
async def test_followup_challenge_for_specific_achievement():
    """CHALLENGE: 구체적 성과 있음 → CHALLENGE 타입 반환"""
    # Given — 수치 포함 구체적 답변
    specific_answer = "저는 직접 시스템을 설계하여 성능을 30% 향상시켰습니다."
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(CHALLENGE_JSON)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/interview/followup", json={
                "question": "문제 해결 경험을 말해주세요.",
                "answer": specific_answer,
                "persona": "tech_lead",
                "resumeText": "이력서",
            })
    assert resp.status_code == 200
    data = resp.json()
    assert data["followupType"] == "CHALLENGE"


@pytest.mark.asyncio
async def test_followup_explore_for_complete_star():
    """EXPLORE: STAR 완성·주도성 높음 → EXPLORE 타입 반환"""
    # Given — STAR 완성 답변
    star_answer = (
        "상황은 팀 생산성이 낮았고, 과제는 프로세스 개선이었습니다. "
        "제가 직접 워크플로우를 재설계했고, 결과적으로 30% 향상됐습니다."
    )
    with patch("app.services.llm_client.OpenAI", return_value=mock_llm(EXPLORE_JSON)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/interview/followup", json={
                "question": "성과를 낸 경험을 말해주세요.",
                "answer": star_answer,
                "persona": "hr",
                "resumeText": "이력서",
            })
    assert resp.status_code == 200
    data = resp.json()
    assert data["followupType"] == "EXPLORE"


@pytest.mark.asyncio
async def test_followup_determinism_same_answer_3_calls():
    """결정론 검증: 동일 answer 3회 → 동일 followupType"""
    # Given
    answer = "제가 직접 제안하여 3개월 만에 프로젝트를 완성했습니다."
    results = []
    for _ in range(3):
        with patch("app.services.llm_client.OpenAI", return_value=mock_llm(CLARIFY_JSON)):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                resp = await ac.post("/api/interview/followup", json={
                    "question": "리더십 경험을 말해주세요.",
                    "answer": answer,
                    "persona": "hr",
                    "resumeText": "이력서",
                })
        results.append(resp.json()["followupType"])
    # Then — 3회 모두 동일
    assert len(set(results)) == 1, f"결정론 실패: {results}"
```

---

## 6. 픽스처 데이터 설계

### 6.1 sample_answers_not_evaluated.json

파일 경로: `engine/tests/fixtures/sample_answers_not_evaluated.json`

```json
[
  {
    "persona": "hr",
    "personaLabel": "HR 담당자",
    "question": "자기소개를 해주세요.",
    "answer": "안녕하세요, 저는 개발자입니다. 열심히 일하겠습니다."
  },
  {
    "persona": "tech_lead",
    "personaLabel": "기술팀장",
    "question": "기술 스택을 설명해주세요.",
    "answer": "Python과 FastAPI를 사용합니다. REST API 설계 경험이 있습니다."
  },
  {
    "persona": "hr",
    "personaLabel": "HR 담당자",
    "question": "팀워크 경험을 말해주세요.",
    "answer": ""
  },
  {
    "persona": "tech_lead",
    "personaLabel": "기술팀장",
    "question": "어려운 기술 문제를 해결한 경험이 있나요?",
    "answer": "   "
  },
  {
    "persona": "executive",
    "personaLabel": "경영진",
    "question": "목표 달성 경험을 말해주세요.",
    "answer": "짧음"
  }
]
```

**설명:**
- 항목 3, 4, 5는 각각 빈 문자열, 공백만, 10자 미만 텍스트 → `has_content=False`
- `not_evaluated` 처리 테스트에 사용

### 6.2 sample_answers_high_score.json

파일 경로: `engine/tests/fixtures/sample_answers_high_score.json`

```json
[
  {
    "persona": "hr",
    "personaLabel": "HR 담당자",
    "question": "자기소개를 해주세요.",
    "answer": "저는 5년간 백엔드 개발을 담당했으며, 직접 MSA 전환 프로젝트를 제안하고 이끌어 응답 시간을 40% 단축했습니다."
  },
  {
    "persona": "tech_lead",
    "personaLabel": "기술팀장",
    "question": "성과를 낸 프로젝트를 설명해주세요.",
    "answer": "상황은 레거시 시스템 병목이었고, 과제는 성능 개선이었습니다. 제가 직접 쿼리를 최적화하여 처리량을 3배 향상시켰고, 결과적으로 서버 비용 30%를 절감했습니다."
  },
  {
    "persona": "hr",
    "personaLabel": "HR 담당자",
    "question": "리더십 경험을 말해주세요.",
    "answer": "5명 팀의 리더로서 스프린트를 직접 설계하고, 2주 만에 MVP를 출시하여 사용자 만족도 90%를 달성했습니다."
  },
  {
    "persona": "tech_lead",
    "personaLabel": "기술팀장",
    "question": "어려운 문제를 어떻게 해결했나요?",
    "answer": "원인을 분석한 결과 3가지 핵심 문제를 도출했고, 각각 대안을 검토하여 가장 효과적인 방법을 선택했습니다. 결과적으로 오류율이 0.1% 이하로 감소했습니다."
  },
  {
    "persona": "executive",
    "personaLabel": "경영진",
    "question": "회사에 기여할 수 있는 점은 무엇인가요?",
    "answer": "제가 직접 자동화 도구를 개발하여 팀 생산성을 25% 향상시킨 경험을 바탕으로, 데이터 기반 의사결정 문화를 도입하겠습니다."
  }
]
```

**설명:**
- 모든 항목에 수치, STAR 구조, 주도성 동사 포함
- `specificity_score > 0`, `star_score > 0.7`, `agency_verb_count >= 2` 기대

### 6.3 sample_answers_low_score.json

파일 경로: `engine/tests/fixtures/sample_answers_low_score.json`

```json
[
  {
    "persona": "hr",
    "personaLabel": "HR 담당자",
    "question": "자기소개를 해주세요.",
    "answer": "항상 최선을 다하며 열심히 노력하는 사람입니다. 성실하게 일하겠습니다."
  },
  {
    "persona": "tech_lead",
    "personaLabel": "기술팀장",
    "question": "기술 역량을 설명해주세요.",
    "answer": "여러 기술을 두루두루 잘 다루며, 다양한 경험이 있습니다."
  },
  {
    "persona": "hr",
    "personaLabel": "HR 담당자",
    "question": "팀워크 경험을 말해주세요.",
    "answer": "팀에서 열심히 협력했습니다. 항상 최선을 다했습니다."
  },
  {
    "persona": "tech_lead",
    "personaLabel": "기술팀장",
    "question": "어려운 문제를 어떻게 해결했나요?",
    "answer": "열심히 고민하고 노력하여 문제를 해결했습니다."
  },
  {
    "persona": "executive",
    "personaLabel": "경영진",
    "question": "목표 달성 경험을 말해주세요.",
    "answer": "열심히 노력해서 목표를 달성했습니다. 항상 최선을 다합니다."
  }
]
```

**설명:**
- 모든 항목에 모호 표현 다수, 수치 없음, STAR 구조 없음
- `specificity_score == 0.0`, `vague_ratio > 0.3`, `agency_verb_count == 0` 기대

---

## 7. conftest.py 추가 fixture 명세

파일 경로: `engine/tests/conftest.py` (기존 파일에 추가)

```python
from dataclasses import dataclass
from app.analyzers.text_analyzer import TextSignals


@pytest.fixture
def mock_text_signals_high():
    """고득점 TextSignals fixture"""
    return TextSignals(
        specificity_score=2.5,
        achievement_score=0.8,
        star_score=1.0,
        vague_ratio=0.05,
        agency_verb_count=3,
        cause_analysis_count=2,
        alternative_count=1,
        has_content=True,
        answer_length=120,
    )


@pytest.fixture
def mock_text_signals_low():
    """저득점 TextSignals fixture"""
    return TextSignals(
        specificity_score=0.0,
        achievement_score=0.0,
        star_score=0.0,
        vague_ratio=0.6,
        agency_verb_count=0,
        cause_analysis_count=0,
        alternative_count=0,
        has_content=True,
        answer_length=25,
    )


@pytest.fixture
def mock_text_signals_not_evaluated():
    """not_evaluated TextSignals fixture (빈 답변)"""
    return TextSignals(
        specificity_score=0.0,
        achievement_score=0.0,
        star_score=0.0,
        vague_ratio=0.0,
        agency_verb_count=0,
        cause_analysis_count=0,
        alternative_count=0,
        has_content=False,
        answer_length=0,
    )


@pytest.fixture
def high_score_history():
    """고득점 패턴 히스토리 픽스처 (fixtures JSON에서 로드)"""
    import json
    from pathlib import Path
    from app.schemas import HistoryItem
    p = Path(__file__).parent / "fixtures/sample_answers_high_score.json"
    data = json.loads(p.read_text(encoding="utf-8"))
    return [HistoryItem(**item) for item in data]


@pytest.fixture
def low_score_history():
    """저득점 패턴 히스토리 픽스처"""
    import json
    from pathlib import Path
    from app.schemas import HistoryItem
    p = Path(__file__).parent / "fixtures/sample_answers_low_score.json"
    data = json.loads(p.read_text(encoding="utf-8"))
    return [HistoryItem(**item) for item in data]


@pytest.fixture
def not_evaluated_history():
    """not_evaluated 케이스 포함 히스토리 픽스처"""
    import json
    from pathlib import Path
    from app.schemas import HistoryItem
    p = Path(__file__).parent / "fixtures/sample_answers_not_evaluated.json"
    data = json.loads(p.read_text(encoding="utf-8"))
    return [HistoryItem(**item) for item in data]
```

---

## 8. 커버리지 80% 달성 전략

### 커버리지 대상 파일 및 우선순위

| 우선순위 | 파일 | 현재 예상 커버리지 | 목표 | 전략 |
|----------|------|--------------------|------|------|
| 1 | `app/analyzers/text_analyzer.py` | 0% (신규) | 95%+ | 섹션 3의 전체 테스트 케이스 구현 |
| 2 | `app/services/report_service.py` | ~70% | 90%+ | not_evaluated 분기 + signals 테스트 추가 |
| 3 | `app/routers/report.py` | ~80% | 85%+ | signals 포함 응답 통합 테스트 추가 |
| 4 | `app/routers/interview.py` | ~75% | 85%+ | followupType 분기별 테스트 추가 |
| 5 | `app/schemas.py` | ~60% | 75%+ | 신규 스키마(AxisScores nullable, FeedbackType 확장) 유효성 테스트 |

### 커버리지 누락 위험 분기 체크리스트

```
text_analyzer.py:
  [ ] analyze("") — 빈 문자열 전체 분기
  [ ] analyze("   ") — 공백만 있는 경우
  [ ] specificity_score 계산: 숫자 있는 경우 / 없는 경우
  [ ] star_score 계산: 0개/일부/전체 구성요소
  [ ] vague_ratio: 0인 경우 / 높은 경우
  [ ] agency_verb_count: 0 / 여러 개

report_service.py:
  [ ] not_evaluated 분기 (has_content=False인 경우)
  [ ] totalScore 계산 — not_evaluated 제외 평균
  [ ] signals 필드 포함 여부
  [ ] 모든 축 not_evaluated → totalScore == 0

schemas.py (신규):
  [ ] AxisScores nullable 필드 (score=None 허용)
  [ ] FeedbackType "not_evaluated" 값 유효성
  [ ] AxisFeedback score=None + type="not_evaluated" 조합
```

---

## 9. pytest 실행 명령어

### 기본 실행

```bash
# 엔진 디렉터리에서 실행
cd engine

# 전체 테스트 (커버리지 포함)
pytest --cov=app --cov-report=term-missing --cov-report=html:htmlcov -v

# 특정 파일만
pytest tests/unit/analyzers/test_text_analyzer.py -v

# 특정 클래스만
pytest tests/unit/analyzers/test_text_analyzer.py::TestSpecificityScore -v

# 특정 테스트만
pytest tests/unit/analyzers/test_text_analyzer.py::TestHasContent::test_empty_string_is_no_content -v
```

### 커버리지 80% 달성 확인

```bash
# 커버리지 80% 미달 시 실패
pytest --cov=app --cov-fail-under=80 --cov-report=term-missing

# 분석기 모듈만 95% 목표 검증
pytest tests/unit/analyzers/ --cov=app/analyzers --cov-fail-under=95

# 서비스 레이어만 90% 목표 검증
pytest tests/unit/services/ --cov=app/services --cov-fail-under=90
```

### 빠른 스모크 테스트 (CI용)

```bash
# 마커 기반 빠른 실행 (느린 통합 테스트 제외)
pytest -m "not slow" --cov=app --cov-fail-under=80 -q

# 비동기 테스트 포함 전체 실행
pytest --asyncio-mode=auto --cov=app --cov-report=term-missing
```

### HTML 커버리지 리포트 확인

```bash
pytest --cov=app --cov-report=html:htmlcov
open htmlcov/index.html   # macOS
start htmlcov/index.html  # Windows
```

---

## 10. 테스트 실행 순서 (TDD: Red → Green → Refactor)

### Phase 1: Red — 실패하는 테스트 먼저 작성

```
Step 1. test_text_analyzer.py 작성
  - analyze() 함수가 없으므로 ImportError → Red
  - TextSignals 데이터클래스가 없으므로 NameError → Red
  확인: pytest tests/unit/analyzers/test_text_analyzer.py → 전체 실패

Step 2. report_service 확장 테스트 추가
  - signals 필드가 ReportResponse에 없으므로 AttributeError → Red
  - not_evaluated 타입이 FeedbackType에 없으므로 ValidationError → Red
  확인: pytest tests/unit/services/test_report_service.py → 신규 테스트 실패

Step 3. 통합 테스트 확장
  - HTTP 응답에 signals 키 없음 → AssertionError → Red
  확인: pytest tests/integration/test_report_router.py → 신규 테스트 실패
```

### Phase 2: Green — 최소 구현으로 통과

```
Step 4. app/analyzers/text_analyzer.py 구현
  - TextSignals 데이터클래스 정의
  - analyze() 함수: 각 신호별 규칙 구현
  목표: pytest tests/unit/analyzers/ → 전체 통과

Step 5. app/schemas.py 수정
  - FeedbackType에 "not_evaluated" 추가
  - AxisScores 필드 nullable 처리 (int | None)
  - AxisFeedback score nullable 처리
  - ReportResponse에 signals 필드 추가
  목표: pytest tests/unit/services/test_report_service.py → 전체 통과

Step 6. app/services/report_service.py 수정
  - analyze() 호출하여 TextSignals 생성
  - has_content=False인 축 → not_evaluated 처리
  - totalScore 계산에서 not_evaluated 제외
  - ReportResponse에 signals 포함
  목표: pytest tests/ → 기존 테스트 + 신규 테스트 전체 통과

Step 7. 커버리지 측정
  pytest --cov=app --cov-fail-under=80 --cov-report=term-missing
  목표: 80% 이상
```

### Phase 3: Refactor — 정리

```
Step 8. text_analyzer.py 리팩터 (if needed)
  - 패턴 상수를 모듈 상단으로 추출
  - 각 신호 계산 함수 분리 (_calc_specificity, _calc_star 등)
  확인: pytest → 통과 유지

Step 9. report_service.py 리팩터 (if needed)
  - _analyze_history() 헬퍼 함수 추출
  - not_evaluated 처리 로직 명확화
  확인: pytest → 통과 유지

Step 10. 최종 커버리지 검증
  pytest --cov=app --cov-fail-under=80 --cov-report=html:htmlcov
  - htmlcov/index.html에서 미커버 라인 확인
  - 필요 시 엣지 케이스 테스트 추가
```

### 전체 TDD 체크리스트

```
Phase 1 (Red):
  [ ] test_text_analyzer.py 작성 완료
  [ ] test_report_service.py 확장 완료
  [ ] test_report_router.py / test_interview_router.py 확장 완료
  [ ] pytest 실행 시 신규 테스트 전체 실패 확인

Phase 2 (Green):
  [ ] text_analyzer.py 구현 → analyzer 유닛 테스트 통과
  [ ] schemas.py 수정 → 스키마 테스트 통과
  [ ] report_service.py 수정 → 서비스 유닛 테스트 통과
  [ ] 통합 테스트 전체 통과
  [ ] 기존 테스트 회귀 없음 확인
  [ ] 커버리지 80% 이상 달성

Phase 3 (Refactor):
  [ ] 코드 정리 후 pytest 재실행 → 전체 통과
  [ ] 최종 커버리지 80%+ 유지
  [ ] .ai.md 최신화
```

---

## 부록: 테스트 파일 디렉터리 구조 (완성 후)

```
engine/tests/
├── conftest.py                              — 공통 fixture (기존 + 신규 fixture 추가)
├── fixtures/
│   ├── input/                              — PDF 픽스처 (기존)
│   ├── output/                             — JSON 픽스처 (기존)
│   ├── sample_answers_not_evaluated.json   — [신규] not_evaluated 케이스
│   ├── sample_answers_high_score.json      — [신규] 고득점 패턴
│   └── sample_answers_low_score.json       — [신규] 저득점 패턴
├── unit/
│   ├── analyzers/
│   │   ├── __init__.py                     — [신규]
│   │   └── test_text_analyzer.py           — [신규] TextSignals 유닛 테스트
│   ├── services/
│   │   ├── test_report_service.py          — [확장] not_evaluated + signals
│   │   ├── test_interview_service.py       — 기존
│   │   └── test_feedback_service.py        — 기존
│   └── parsers/
│       └── test_pdf_parser.py              — 기존
└── integration/
    ├── test_report_router.py               — [확장] signals 필드 + not_evaluated
    ├── test_interview_router.py            — [확장] followupType 분기 결정론
    └── test_resume_feedback_router.py      — 기존
```
