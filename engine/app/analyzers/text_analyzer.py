"""
engine/app/analyzers/text_analyzer.py

규칙 기반 텍스트 분석 엔진 — 결정론적 신호 측정.
동일 입력 → 항상 동일 출력. LLM 미사용.

## 설계 원칙
점수 생성은 이 모듈의 결정론적 규칙에서 나온다.
LLM은 측정된 신호를 받아 자연어 피드백 텍스트만 생성한다.

## 키워드 출처
키워드 상수는 keywords.py 참조 (출처 주석 포함).
"""

from dataclasses import dataclass

from .keywords import (
    VAGUE_WORDS,
    AGENCY_VERB_STEMS,
    SPECIFICITY_PATTERNS,
    STAR_KEYWORDS,
    STAR_WEIGHTS,
    STAR_TOTAL_WEIGHT,
    ACHIEVEMENT_PATTERNS,
    CAUSE_ANALYSIS_WORDS,
    ALTERNATIVE_WORDS,
    HAS_CONTENT_MIN_CHARS,
)


# ---------------------------------------------------------------------------
# 분석 결과 타입
# ---------------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class TextSignals:
    """텍스트 분석 결과. 모든 필드는 순수 함수로 계산되며 결정론적이다."""

    # --- 구체성 ---
    specificity_score: float
    """SPECIFICITY_PATTERNS 수치 단위 감지 점수 (0.0~1.0). KRIVET 기반."""

    # --- 성과 ---
    achievement_score: float
    """ACHIEVEMENT_PATTERNS 수치+성과동사 조합 점수 (0.0~1.0)."""

    # --- STAR 구조 ---
    star_score: float
    """STAR 4요소 완성도 (0.0~1.0). Action 2배 가중."""

    # --- 모호함 ---
    vague_ratio: float
    """VAGUE_WORDS 전체 단어 대비 비율 (0.0~1.0). 낮을수록 좋음."""

    # --- 주도성 ---
    agency_verb_count: int
    """AGENCY_VERB_STEMS 어간 매칭 횟수. NCS 행동지표 동사."""

    # --- 논리적 사고 ---
    cause_analysis_count: int
    """원인 분석 표현 매칭 횟수."""

    alternative_count: int
    """대안 고려 표현 매칭 횟수."""

    # --- 메타 ---
    has_content: bool
    """답변 존재 여부 (공백 제거 후 HAS_CONTENT_MIN_CHARS 이상). False → not_evaluated 트리거."""

    answer_length: int
    """공백 제거 후 글자 수."""


# ---------------------------------------------------------------------------
# 내부 측정 함수
# ---------------------------------------------------------------------------

def _check_content(text: str) -> tuple[bool, int]:
    """답변 존재 여부와 글자 수를 반환. HAS_CONTENT_MIN_CHARS 미만은 유효 답변 없음으로 판단."""
    stripped = text.strip()
    return len(stripped) >= HAS_CONTENT_MIN_CHARS, len(stripped)


def _count_unique_spans(spans: list[tuple[int, int]]) -> int:
    """겹치는 span은 하나로 카운트. 동일 수치를 여러 패턴이 잡는 경우 방지."""
    if not spans:
        return 0
    sorted_spans = sorted(spans)
    count = 1
    _, end = sorted_spans[0]
    for start, new_end in sorted_spans[1:]:
        if start >= end:
            count += 1
            end = new_end
        else:
            end = max(end, new_end)
    return count


def _calc_specificity(text: str) -> float:
    """수치 표현 감지 → 0.0~1.0 점수 반환.

    알고리즘:
    1. SPECIFICITY_PATTERNS 각 패턴으로 전체 텍스트 매칭
    2. 겹치는 span 제거 후 unique match count 집계
    3. min(count / 3, 1.0) — 3개 이상 수치 표현 시 만점
    """
    spans: list[tuple[int, int]] = []
    for pattern in SPECIFICITY_PATTERNS:
        for m in pattern.finditer(text):
            spans.append(m.span())
    return min(_count_unique_spans(spans) / 3, 1.0)


def _calc_achievement(text: str) -> float:
    """성과+수치 조합 감지 → 0.0~1.0 점수 반환.

    알고리즘:
    1. ACHIEVEMENT_PATTERNS 각 패턴으로 전체 텍스트 매칭
    2. 겹치는 span 제거 후 unique match count 집계
    3. min(count / 2, 1.0) — 2개 이상 성과-수치 조합 시 만점
    """
    spans: list[tuple[int, int]] = []
    for pattern in ACHIEVEMENT_PATTERNS:
        for m in pattern.finditer(text):
            spans.append(m.span())
    return min(_count_unique_spans(spans) / 2, 1.0)


def _calc_star(text: str) -> float:
    """STAR 4요소 완성도 → 0.0~1.0 점수 반환.

    알고리즘:
    - S/T/A/R 각 요소 키워드 존재 여부 확인
    - Action 2배 가중 (가중합 / 5.0)
    """
    score = 0.0
    for element, keywords in STAR_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            score += STAR_WEIGHTS[element]
    return score / STAR_TOTAL_WEIGHT


def _calc_vague_ratio(text: str) -> float:
    """모호 표현 비율 → 0.0~1.0 반환.

    알고리즘:
    - 공백 기준 토큰화
    - token.startswith(vw)로 조사 붙은 형태 처리
    - vague_count / total_tokens
    """
    tokens = text.split()
    if not tokens:
        return 0.0
    vague_count = sum(
        1 for token in tokens
        if any(token.startswith(vw) for vw in VAGUE_WORDS)
    )
    return vague_count / len(tokens)


def _count_agency_verbs(text: str) -> int:
    """주도성 동사 어간 매칭 횟수 합산.

    AGENCY_VERB_STEMS 각 어간에 대해 text.count(stem) 합산.
    "주도" → "주도했", "주도하여", "주도한", "주도적" 모두 잡힘.
    """
    return sum(text.count(stem) for stem in AGENCY_VERB_STEMS)


def _count_cause_analysis(text: str) -> int:
    """원인 분석 표현 매칭 횟수. 어구(phrase) 단위 매칭."""
    return sum(text.count(phrase) for phrase in CAUSE_ANALYSIS_WORDS)


def _count_alternatives(text: str) -> int:
    """대안 고려 표현 매칭 횟수. 어구(phrase) 단위 매칭."""
    return sum(text.count(phrase) for phrase in ALTERNATIVE_WORDS)


# ---------------------------------------------------------------------------
# 공개 API
# ---------------------------------------------------------------------------

def analyze(text: str) -> TextSignals:
    """텍스트를 분석하여 TextSignals를 반환한다.

    Args:
        text: 분석 대상 텍스트 (면접 답변 또는 자소서)

    Returns:
        TextSignals: 결정론적 분석 결과.
        has_content=False이면 모든 점수가 기본값(0/False).
    """
    has_content, answer_length = _check_content(text)

    if not has_content:
        return TextSignals(
            specificity_score=0.0,
            achievement_score=0.0,
            star_score=0.0,
            vague_ratio=0.0,
            agency_verb_count=0,
            cause_analysis_count=0,
            alternative_count=0,
            has_content=False,
            answer_length=answer_length,
        )

    return TextSignals(
        specificity_score=_calc_specificity(text),
        achievement_score=_calc_achievement(text),
        star_score=_calc_star(text),
        vague_ratio=_calc_vague_ratio(text),
        agency_verb_count=_count_agency_verbs(text),
        cause_analysis_count=_count_cause_analysis(text),
        alternative_count=_count_alternatives(text),
        has_content=True,
        answer_length=answer_length,
    )
