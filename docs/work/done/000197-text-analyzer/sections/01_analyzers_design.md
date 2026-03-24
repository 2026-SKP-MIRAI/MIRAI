# 01. analyzers/ 모듈 아키텍처 설계

> Issue #197 — LLM 기반 채점을 규칙 기반(결정론적) 텍스트 분석으로 전환

---

## 1. 모듈 구조

```
engine/app/analyzers/
├── __init__.py          # public API: analyze, TextSignals
├── keywords.py          # 키워드·패턴 상수 정의
└── text_analyzer.py     # TextSignals 데이터클래스 + 측정 함수
```

### import 관계

```
__init__.py
  └── from .text_analyzer import analyze, TextSignals

text_analyzer.py
  └── from .keywords import (
        VAGUE_WORDS, AGENCY_VERBS,
        SPECIFICITY_PATTERNS, STAR_KEYWORDS,
        ACHIEVEMENT_PATTERNS,
        CAUSE_ANALYSIS_WORDS, ALTERNATIVE_WORDS,
      )

keywords.py
  └── (외부 의존성 없음 — 상수만 정의)
```

### 외부 의존성

- Python 표준 라이브러리만 사용: `re`, `dataclasses`
- 별도 NLP 라이브러리 불필요 (정규식 + 키워드 매칭 기반)

---

## 2. TextSignals 데이터클래스

```python
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class TextSignals:
    """텍스트 분석 결과. 모든 필드는 순수 함수로 계산되며 결정론적이다."""

    # --- 구체성 ---
    specificity_score: float
    """SPECIFICITY_PATTERNS 수치 단위 감지 점수 (0.0~1.0).
    KRIVET 직업기초능력평가 기반 — 수치·단위·비율·기간 패턴 매칭."""

    # --- 성과 ---
    achievement_score: float
    """ACHIEVEMENT_PATTERNS 수치+성과동사 조합 점수 (0.0~1.0).
    성과를 정량적으로 제시했는지 측정."""

    # --- STAR 구조 ---
    star_score: float
    """STAR 4요소 완성도 (0.0~1.0).
    S/T/A/R 각 요소 감지 여부 기반, Action 2배 가중."""

    # --- 모호함 ---
    vague_ratio: float
    """VAGUE_WORDS 전체 단어 대비 비율 (0.0~1.0).
    사람인 텍스트마이닝 기반 모호 표현 빈도."""

    # --- 주도성 ---
    agency_verb_count: int
    """AGENCY_VERBS 매칭 횟수.
    NCS 직업기초능력 행동지표 동사."""

    # --- 논리적 사고 ---
    cause_analysis_count: int
    """원인 분석 표현 매칭 횟수."""

    alternative_count: int
    """대안 고려 표현 매칭 횟수."""

    # --- 메타 ---
    has_content: bool
    """답변 존재 여부. False면 해당 축 not_evaluated 트리거."""

    answer_length: int
    """답변 글자 수 (공백 포함)."""
```

### 설계 결정

| 결정 | 이유 |
|------|------|
| `frozen=True` | 불변 객체 — 생성 후 변경 불가, 서비스 레이어에서 안전하게 전달 |
| `slots=True` | 메모리 효율 + 속성 오타 방지 |
| 점수 범위 0.0~1.0 | 서비스 레이어(루브릭)가 0~100 변환 책임. analyzer는 정규화된 비율만 반환 |
| `has_content` 별도 필드 | 빈 답변/미응답 시 채점 자체를 건너뛰는 로직의 진입점 |

---

## 3. keywords.py 상세 설계

```python
"""
키워드·패턴 상수 정의.

근거 자료:
- VAGUE_WORDS: 사람인 텍스트마이닝 (자소서 빈출 모호 표현)
- AGENCY_VERBS: NCS 직업기초능력 행동지표
- SPECIFICITY_PATTERNS: KRIVET 직업기초능력평가 수치 표현
- STAR_KEYWORDS: 행동면접(BEI) 구조화 질문 기법
- ACHIEVEMENT_PATTERNS: 성과+수치 조합 (사람인·잡코리아 합격 자소서 분석)
- CAUSE_ANALYSIS_WORDS: 논리적 사고 평가 (원인 분석 표현)
- ALTERNATIVE_WORDS: 문제해결 평가 (대안 고려 표현)
"""

import re
from typing import Final


# ──────────────────────────────────────────────
# 1. VAGUE_WORDS — 사람인 텍스트마이닝 기반 모호 표현
# ──────────────────────────────────────────────
VAGUE_WORDS: Final[frozenset[str]] = frozenset({
    "다양한", "많은", "좋은", "여러", "항상",
    "최선을", "열심히", "노력", "적극적으로", "최대한",
    "효과적으로", "성공적으로", "뛰어난", "우수한", "탁월한",
    "능동적으로", "긍정적으로", "원활하게", "효율적으로", "체계적으로",
})


# ──────────────────────────────────────────────
# 2. AGENCY_VERBS — NCS 직업기초능력 행동지표 동사
# ──────────────────────────────────────────────
AGENCY_VERBS: Final[frozenset[str]] = frozenset({
    "이끌다", "주도하다", "제안하다", "분석하다", "설득하다",
    "조율하다", "실행하다", "기획하다", "설계하다", "구현하다",
    "검증하다", "개선하다", "해결하다", "도입하다", "최적화하다",
    "리드하다", "발표하다", "조사하다", "협상하다", "전환하다",
})

# 동사 어간 추출용 (활용형 매칭): "주도했", "주도하여", "주도한" 등
AGENCY_VERB_STEMS: Final[tuple[str, ...]] = tuple(
    v.replace("다", "") for v in AGENCY_VERBS
)


# ──────────────────────────────────────────────
# 3. SPECIFICITY_PATTERNS — 수치 감지 정규식
#    KRIVET 직업기초능력평가 기반
# ──────────────────────────────────────────────
SPECIFICITY_PATTERNS: Final[list[re.Pattern[str]]] = [
    # 숫자 + 단위 (명, 건, 원, 개, 회, 배, 시간 등)
    re.compile(r"\d+[,.]?\d*\s*(명|건|원|개|회|배|시간|일|개월|년|주|%)"),
    # 비율 표현 (30%, 0.5배 등)
    re.compile(r"\d+[,.]?\d*\s*%"),
    # 금액 표현 (100만원, 5억 등)
    re.compile(r"\d+[,.]?\d*\s*(만|억|천)\s*원?"),
    # 기간 표현 (3개월간, 2년 동안 등)
    re.compile(r"\d+\s*(개월|년|주|일)\s*(간|동안|만에|이내)?"),
    # 순위/등수 (1위, 상위 10% 등)
    re.compile(r"(상위|하위)?\s*\d+\s*(위|등|위권)"),
    # 증감 표현 (20% 감소, 3배 증가 등)
    re.compile(r"\d+[,.]?\d*\s*(%|배)\s*(증가|감소|향상|개선|절감|단축)"),
    # n 대 m, n/m 비율
    re.compile(r"\d+\s*(대|\/)\s*\d+"),
    # ~부터 ~까지 기간
    re.compile(r"\d{4}\s*[.년]\s*\d{1,2}\s*[.월]"),
]


# ──────────────────────────────────────────────
# 4. STAR_KEYWORDS — STAR 구조 요소별 키워드
#    행동면접(BEI) 구조화 기법 기반
# ──────────────────────────────────────────────
STAR_KEYWORDS: Final[dict[str, list[str]]] = {
    "situation": [
        "당시", "상황에서", "배경은", "맥락에서", "환경에서",
        "그때", "시점에", "시기에", "팀에서", "프로젝트에서",
        "회사에서", "부서에서", "조직에서",
    ],
    "task": [
        "목표는", "과제는", "역할은", "담당한", "맡은",
        "책임은", "요구사항", "미션은", "해야 했", "필요했",
        "기대한", "요청받은",
    ],
    "action": [
        "직접", "스스로", "먼저", "주도적으로", "제가",
        "구현했", "설계했", "분석했", "도입했", "제안했",
        "기획했", "실행했", "개발했", "해결했", "적용했",
        "테스트했", "배포했", "자동화했",
    ],
    "result": [
        "결과", "성과", "달성", "개선", "향상",
        "절감", "단축", "증가", "감소", "효과",
        "매출", "수익", "비용", "시간", "생산성",
        "만족도", "평가받", "인정받",
    ],
}


# ──────────────────────────────────────────────
# 5. ACHIEVEMENT_PATTERNS — 성과+수치 조합 패턴
#    사람인·잡코리아 합격 자소서 분석 기반
# ──────────────────────────────────────────────
ACHIEVEMENT_PATTERNS: Final[list[re.Pattern[str]]] = [
    # 성과동사 + 수치
    re.compile(
        r"(달성|개선|향상|절감|단축|증가|감소|확보|유치|돌파)"
        r".{0,10}"
        r"\d+[,.]?\d*\s*(명|건|원|개|%|배|만|억)"
    ),
    # 수치 + 성과동사
    re.compile(
        r"\d+[,.]?\d*\s*(명|건|원|개|%|배|만|억)"
        r".{0,10}"
        r"(달성|개선|향상|절감|단축|증가|감소|확보|유치|돌파)"
    ),
    # "~를 n% 개선" 패턴
    re.compile(
        r".{1,20}"
        r"(을|를)\s*"
        r"\d+[,.]?\d*\s*(%|배|만|억)\s*"
        r"(개선|향상|절감|단축|증가|감소)"
    ),
]


# ──────────────────────────────────────────────
# 6. CAUSE_ANALYSIS_WORDS — 원인 분석 표현
# ──────────────────────────────────────────────
CAUSE_ANALYSIS_WORDS: Final[frozenset[str]] = frozenset({
    "왜냐하면", "원인은", "분석한 결과", "이유는",
    "근본 원인", "때문에", "파악한 결과", "조사한 결과",
    "원인을 분석", "문제의 근본", "데이터를 분석",
    "로그를 확인", "원인 파악", "진단한 결과",
})


# ──────────────────────────────────────────────
# 7. ALTERNATIVE_WORDS — 대안 고려 표현
# ──────────────────────────────────────────────
ALTERNATIVE_WORDS: Final[frozenset[str]] = frozenset({
    "대신에", "또 다른 방법", "다른 접근", "대안으로",
    "비교한 결과", "검토한 결과", "선택지", "옵션으로",
    "트레이드오프", "장단점을 비교", "여러 방안",
    "A안과 B안", "비교 분석", "대체 방안",
})
```

### 키워드 카테고리 요약

| 카테고리 | 자료형 | 근거 | 용도 |
|----------|--------|------|------|
| `VAGUE_WORDS` | `frozenset[str]` | 사람인 텍스트마이닝 | `vague_ratio` 계산 |
| `AGENCY_VERBS` / `AGENCY_VERB_STEMS` | `frozenset[str]` / `tuple[str]` | NCS 행동지표 | `agency_verb_count` 계산 |
| `SPECIFICITY_PATTERNS` | `list[re.Pattern]` | KRIVET | `specificity_score` 계산 |
| `STAR_KEYWORDS` | `dict[str, list[str]]` | BEI 기법 | `star_score` 계산 |
| `ACHIEVEMENT_PATTERNS` | `list[re.Pattern]` | 합격 자소서 분석 | `achievement_score` 계산 |
| `CAUSE_ANALYSIS_WORDS` | `frozenset[str]` | 논리적 사고 평가 | `cause_analysis_count` 계산 |
| `ALTERNATIVE_WORDS` | `frozenset[str]` | 문제해결 평가 | `alternative_count` 계산 |

---

## 4. text_analyzer.py 함수별 알고리즘

### 4.1 public API

```python
def analyze(text: str) -> TextSignals:
    """텍스트를 분석하여 TextSignals를 반환한다.

    Args:
        text: 분석 대상 텍스트 (답변 또는 자소서)

    Returns:
        TextSignals: 모든 필드가 채워진 분석 결과
    """
```

`analyze()`는 각 측정 함수를 호출하여 `TextSignals`를 조립한다.
빈 문자열/공백만 있는 입력은 `has_content=False`로 처리하고 나머지 필드는 기본값(0.0/0)으로 채운다.

### 4.2 has_content / answer_length

```python
def _check_content(text: str) -> tuple[bool, int]:
    """답변 존재 여부와 글자 수를 반환."""
    stripped = text.strip()
    return (len(stripped) > 0, len(stripped))
```

- `strip()` 후 길이 0이면 `has_content=False`
- `answer_length`는 공백 제거 후 글자 수 (strip만, 내부 공백은 유지)

### 4.3 specificity_score

```python
def _calc_specificity(text: str) -> float:
    """수치 표현 감지 → 0.0~1.0 점수 반환.

    알고리즘:
    1. SPECIFICITY_PATTERNS 각 패턴으로 전체 텍스트 매칭
    2. 중복 제거된 매치 수(match_count) 집계
    3. 정규화: min(match_count / 3, 1.0)
       — 3개 이상 수치 표현 시 만점 (KRIVET 기준 '충분히 구체적')
    """
```

**정규화 기준**: 면접 답변 1개에 수치 표현 3개 이상이면 '구체적'으로 판단.
이 기준은 KRIVET 직업기초능력평가의 "수리능력" 항목에서 "정량적 근거 3개 이상 제시" 기준에 근거.

매칭 시 중복 제거 방법:
- 각 패턴의 `findall()` 결과의 시작 위치(span)를 수집
- 겹치는 span은 하나로 카운트 (동일 수치를 여러 패턴이 잡는 경우 방지)

### 4.4 achievement_score

```python
def _calc_achievement(text: str) -> float:
    """성과+수치 조합 감지 → 0.0~1.0 점수 반환.

    알고리즘:
    1. ACHIEVEMENT_PATTERNS 각 패턴으로 전체 텍스트 매칭
    2. 중복 제거된 매치 수 집계
    3. 정규화: min(match_count / 2, 1.0)
       — 2개 이상 성과-수치 조합 시 만점
    """
```

**정규화 기준**: 성과+수치 조합은 specificity보다 까다로운 패턴이므로 2개면 만점.

### 4.5 star_score

```python
def _calc_star(text: str) -> float:
    """STAR 4요소 완성도 → 0.0~1.0 점수 반환.

    알고리즘:
    1. STAR_KEYWORDS의 S/T/A/R 각 요소에 대해 키워드 존재 여부 확인
    2. 가중치 적용:
       - Situation: 1.0
       - Task:      1.0
       - Action:    2.0  (행동이 면접 답변의 핵심)
       - Result:    1.0
    3. 감지된 요소의 가중치 합 / 전체 가중치 합(5.0)

    예시:
    - S+T+A+R 모두 감지 → (1+1+2+1)/5 = 1.0
    - S+A+R 감지 (T 누락) → (1+0+2+1)/5 = 0.8
    - A만 감지 → 2/5 = 0.4
    """
```

**Action 2배 가중 근거**: BEI(Behavioral Event Interview) 기법에서 면접관이 가장 주의 깊게 평가하는 요소는 "지원자가 실제로 취한 행동(Action)"이다. 상황 설명이나 결과보다 행동의 구체성이 역량 판별에 결정적이라는 연구 결과(Spencer & Spencer, 1993)에 기반.

가중치 상수:

```python
STAR_WEIGHTS: Final[dict[str, float]] = {
    "situation": 1.0,
    "task":      1.0,
    "action":    2.0,
    "result":    1.0,
}
STAR_TOTAL_WEIGHT: Final[float] = sum(STAR_WEIGHTS.values())  # 5.0
```

### 4.6 vague_ratio

```python
def _calc_vague_ratio(text: str) -> float:
    """모호 표현 비율 → 0.0~1.0 반환.

    알고리즘:
    1. 텍스트를 공백 기준 토큰화 (단순 split)
    2. 각 토큰이 VAGUE_WORDS에 포함되는지 확인
    3. vague_count / total_word_count
    4. total_word_count == 0이면 0.0 반환
    """
```

**토큰화 방식**: 형태소 분석기 없이 `text.split()` 사용.
모호 표현은 대부분 독립된 어절(관형사, 부사)이므로 공백 분리만으로 충분한 정밀도 확보.
조사가 붙는 경우("다양한이", "많은데") 대비로 `any(token.startswith(vw) for vw in VAGUE_WORDS)` 방식 적용.

### 4.7 agency_verb_count

```python
def _count_agency_verbs(text: str) -> int:
    """주도성 동사 어간 매칭 횟수 반환.

    알고리즘:
    1. AGENCY_VERB_STEMS 각 어간에 대해 텍스트 내 출현 횟수 합산
    2. 어간 매칭: "주도" → "주도했", "주도하여", "주도한", "주도적" 모두 잡힘
    3. text.count(stem)으로 단순 카운트 (중복 허용)
    """
```

**어간 매칭 방식**: 한국어 동사 활용은 어간+어미 구조이므로, 어간("주도", "제안", "분석" 등)만으로 활용형 대부분을 커버한다. `text.count(stem)`은 O(n*m)이지만 어간 20개 × 답변 ~5000자 수준에서 성능 이슈 없음.

### 4.8 cause_analysis_count

```python
def _count_cause_analysis(text: str) -> int:
    """원인 분석 표현 매칭 횟수 반환.

    알고리즘:
    1. CAUSE_ANALYSIS_WORDS 각 표현에 대해 text 내 출현 횟수 합산
    2. 어구(phrase) 단위 매칭 — "분석한 결과" 같은 2어절 표현도 매칭
    """
```

### 4.9 alternative_count

```python
def _count_alternatives(text: str) -> int:
    """대안 고려 표현 매칭 횟수 반환.

    알고리즘:
    1. ALTERNATIVE_WORDS 각 표현에 대해 text 내 출현 횟수 합산
    2. cause_analysis_count와 동일한 매칭 방식
    """
```

### 4.10 analyze() 조립

```python
def analyze(text: str) -> TextSignals:
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
            answer_length=0,
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
```

---

## 5. 서비스 통합 흐름

### 5.1 report_service → analyzers

```
report_service.generate_report(resumeText, history)
│
├─ 기존: _build_prompt() → call_llm() → _parse_report()  [전체 LLM 1회]
│
└─ 변경 후:
   ┌──────────────────────────────────────────────────┐
   │ for item in history:                              │
   │   signals = analyzers.analyze(item.answer)        │
   │   signals_list.append(signals)                    │
   ├──────────────────────────────────────────────────┤
   │ 축별 루브릭 적용 (deterministic)                    │
   │   communication  ← star_score + vague_ratio       │
   │   problemSolving ← cause_analysis + alternative   │
   │   logicalThinking ← cause_analysis + star_score   │
   │   jobExpertise   ← specificity + achievement      │
   │   cultureFit     ← agency_verbs + star(T요소)     │
   │   leadership     ← agency_verbs + star(A요소)     │
   │   creativity     ← alternative + achievement      │
   │   sincerity      ← has_content + answer_length    │
   ├──────────────────────────────────────────────────┤
   │ LLM 호출 (summary + axisFeedbacks 텍스트만)        │
   │ — 점수는 규칙 기반, 텍스트 피드백만 LLM 담당       │
   └──────────────────────────────────────────────────┘
```

**핵심 변경**: 점수(scores)는 analyzers의 규칙 기반 계산 결과로 결정. LLM은 점수를 받아서 자연어 피드백 텍스트만 생성. 이로써 점수의 결정론성이 보장된다.

### 5.2 interview_service (followup) → analyzers

```
interview_service.process_answer(...)
│
├─ 기존: _check_followup() → LLM이 shouldFollowUp/followupType 결정
│
└─ 변경 후:
   ┌──────────────────────────────────────────────────┐
   │ signals = analyzers.analyze(currentAnswer)        │
   ├──────────────────────────────────────────────────┤
   │ followupType 분류 (규칙 기반):                     │
   │                                                    │
   │ if signals.star_score < 0.4:                      │
   │     → CLARIFY (STAR 불완전 — 구체화 요청)          │
   │ elif signals.agency_verb_count == 0:              │
   │     → CLARIFY (주도성 미감지 — 행동 구체화)        │
   │ elif signals.vague_ratio > 0.15:                  │
   │     → CHALLENGE (모호 표현 과다 — 근거 요청)       │
   │ elif signals.cause_analysis_count == 0            │
   │     and signals.alternative_count == 0:           │
   │     → CHALLENGE (논리적 분석 미감지)               │
   │ else:                                              │
   │     → EXPLORE (충분한 답변 — 심화 탐색)            │
   ├──────────────────────────────────────────────────┤
   │ LLM 호출: followupType + signals를 컨텍스트로     │
   │ 전달하여 구체적인 후속 질문 텍스트만 생성           │
   └──────────────────────────────────────────────────┘
```

### 5.3 feedback_service → analyzers

```
feedback_service.generate_resume_feedback(resume_text, ...)
│
├─ 기존: LLM이 scores + strengths + weaknesses + suggestions 전부 생성
│
└─ 변경 후:
   ┌──────────────────────────────────────────────────┐
   │ signals = analyzers.analyze(resume_text)          │
   ├──────────────────────────────────────────────────┤
   │ signals를 응답의 보조 데이터로 포함                 │
   │ specificity → scores.specificity 보정에 활용       │
   │ achievement → scores.achievementClarity 보정       │
   │ star_score → scores.logicStructure 보정            │
   ├──────────────────────────────────────────────────┤
   │ LLM에 signals 요약을 프롬프트에 포함하여           │
   │ 더 근거 있는 피드백 텍스트 생성 유도               │
   └──────────────────────────────────────────────────┘
```

---

## 6. 구현 단계

### Phase 1: 기반 모듈 (analyzers 독립 구현)

| 순서 | 파일 | 내용 | 선행 조건 |
|------|------|------|-----------|
| 1-1 | `engine/app/analyzers/keywords.py` | 키워드·패턴 상수 전체 정의 | 없음 |
| 1-2 | `engine/app/analyzers/text_analyzer.py` | TextSignals + 측정 함수 + analyze() | keywords.py |
| 1-3 | `engine/app/analyzers/__init__.py` | public API 노출 (`analyze`, `TextSignals`) | text_analyzer.py |
| 1-4 | `engine/tests/test_text_analyzer.py` | 단위 테스트 (각 측정 함수 + analyze) | 1-1 ~ 1-3 |

### Phase 2: 서비스 통합

| 순서 | 파일 | 내용 | 선행 조건 |
|------|------|------|-----------|
| 2-1 | `engine/app/services/report_service.py` | analyze() 호출 → 규칙 기반 점수 산출 | Phase 1 |
| 2-2 | `engine/app/services/interview_service.py` | followupType 규칙 분류 로직 추가 | Phase 1 |
| 2-3 | `engine/app/services/feedback_service.py` | signals를 프롬프트 보조 데이터로 포함 | Phase 1 |
| 2-4 | `engine/tests/test_report_service.py` | 통합 테스트 (규칙 점수 + LLM 피드백) | 2-1 |
| 2-5 | `engine/tests/test_interview_followup.py` | followupType 분류 테스트 | 2-2 |

### 구현 순서 근거

1. **keywords.py 먼저**: 외부 의존성 없는 순수 상수. 다른 모든 것의 기반.
2. **text_analyzer.py 다음**: keywords에만 의존. 독립적으로 테스트 가능.
3. **테스트 즉시**: TDD 원칙 — analyze 모듈 완성 즉시 단위 테스트.
4. **서비스 통합은 마지막**: 기존 서비스 코드 변경 최소화, analyzer가 검증된 후 투입.

---

## 부록: 설계 제약 사항

| 제약 | 근거 |
|------|------|
| 외부 NLP 라이브러리 사용 금지 | Docker 이미지 경량화, 빌드 시간 단축 |
| 엔진 불변식 준수 | analyzer는 `engine/app/` 내부 모듈이므로 서비스가 직접 import |
| 한국어 전용 | 현재 MirAI 사용자 범위 (추후 다국어 시 keywords.py만 확장) |
| Python 3.12+ | 엔진 Dockerfile 기준 (`python:3.12-slim`) |
| 점수 범위 0.0~1.0 | 서비스 레이어(루브릭)가 0~100 변환 책임 분리 |
