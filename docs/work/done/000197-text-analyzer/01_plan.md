# [#197] feat: [engine] 규칙 기반 텍스트 분석 엔진 — 구현 계획

> 작성: 2026-03-23
> 완료: 2026-03-24
> 팀: worker-1 (planner) + worker-2 (architect) + worker-3 (test-engineer)
> 섹션 상세: `sections/01_analyzers_design.md`, `sections/02_schema_rubric_design.md`, `sections/03_test_plan.md`

---

## 문제 정의

### 기존 방식의 문제

기존 `/api/report/generate`는 LLM이 면접 답변을 읽고 점수(0~100)와 피드백 텍스트를 동시에 생성했다.

```
answer → LLM → 점수 + 피드백  (비결정론적)
```

이로 인해 두 가지 문제가 발생했다:

1. **비결정론**: 동일한 답변을 제출해도 LLM 응답이 매번 달라 점수가 변동됨. 사용자가 신뢰하기 어려운 평가.
2. **not_evaluated 불가**: 답변이 비어있거나 너무 짧을 때도 LLM이 임의의 점수를 부여함. "평가 불가" 상태를 명시적으로 표현할 수 없었음.

### 해결 전략

**점수는 규칙, 피드백 텍스트는 LLM**으로 역할을 분리했다.

```
answer → analyzers → TextSignals → 루브릭 → 점수  (결정론적)
                                        ↓
                                   LLM → 피드백 텍스트만  (비결정론 허용)
```

- `app/analyzers/` 모듈이 텍스트를 분석해 `TextSignals`(수치 구체성, STAR 완성도, 주도성 동사 수 등)를 계산
- 8축 루브릭이 `TextSignals`를 0~100 점수로 변환 → **항상 동일한 입력 = 동일한 점수**
- LLM은 이미 계산된 점수와 신호를 받아 자연어 피드백 텍스트만 생성
- `has_content=False`(빈 답변/20자 미만)인 경우 `not_evaluated`로 명시적 구분

---

## 완료 기준

### 규칙 기반 측정 엔진
- [x] 동일 텍스트 입력 시 항상 동일 점수 반환 (결정론적)
- [x] 응답에 `signals` 필드 추가 (기존 scores 유지, 근거 데이터 추가)
- [x] 8축 점수에 측정 근거 포함
- [x] followup 유형 분류가 규칙 기반으로 동작 (LLM 보조)
- [x] pytest 커버리지 80% 이상 → **실제: 93.54%**

### not_evaluated 타입 도입 (구 #72)
- [x] 8축별 채점 루브릭 명시 (측정값 기반 해석 기준)
- [x] `AxisFeedback`에 `not_evaluated` 추가 — 답변 근거 없는 축 명시적 구분
- [x] `not_evaluated` 축은 `totalScore` 계산에서 제외
- [x] `not_evaluated` 축의 `score`는 `null` 반환 (AxisScores·AxisFeedback 스키마 수정)
- [x] `report_evaluation_v1.md` 삭제하지 않고 보존 (버전 이력 유지)

---

## 구현 계획

### 핵심 전략

**점수는 규칙, 텍스트는 LLM**: `analyzers/` 모듈이 TextSignals(결정론적)를 계산하고, 루브릭이 이를 0~100 점수로 변환. LLM은 점수를 받아 자연어 피드백 텍스트만 생성.

```
현재: answer → LLM → 점수 + 피드백  (비결정론적)
변경: answer → analyzers → TextSignals → 루브릭 → 점수 (결정론적)
                                               ↓
                                          LLM → 피드백 텍스트만
```

---

## Phase 1: analyzers/ 모듈 신규 구현

> 상세 설계: `sections/01_analyzers_design.md`

### 디렉터리 구조

```
engine/app/analyzers/
├── __init__.py          # public API: analyze, TextSignals
├── keywords.py          # 키워드·패턴 상수 (외부 의존성 없음)
└── text_analyzer.py     # TextSignals 데이터클래스 + 측정 함수
```

### TextSignals 데이터클래스

```python
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class TextSignals:
    specificity_score:    float  # 수치 구체성 0.0~1.0 (KRIVET 기반)
    achievement_score:    float  # 성과+수치 조합 0.0~1.0
    star_score:           float  # STAR 완성도 0.0~1.0 (Action 2배 가중)
    vague_ratio:          float  # 모호 표현 비율 0.0~1.0 (낮을수록 좋음)
    agency_verb_count:    int    # 주도성 동사 횟수 (NCS 행동지표)
    cause_analysis_count: int    # 원인 분석 표현 횟수
    alternative_count:    int    # 대안 고려 표현 횟수
    has_content:          bool   # False → not_evaluated 트리거
    answer_length:        int    # 공백 제거 후 글자 수
```

### 키워드 카테고리 (keywords.py)

| 카테고리 | 근거 | 용도 |
|----------|------|------|
| `VAGUE_WORDS` (frozenset) | 사람인 텍스트마이닝 | `vague_ratio` 계산 |
| `AGENCY_VERBS` + `AGENCY_VERB_STEMS` | NCS 직업기초능력 행동지표 | `agency_verb_count` 계산 |
| `SPECIFICITY_PATTERNS` (list[re.Pattern]) | KRIVET 직업기초능력평가 | `specificity_score` 계산 |
| `STAR_KEYWORDS` (dict) | BEI(행동면접) 구조화 기법 | `star_score` 계산 |
| `ACHIEVEMENT_PATTERNS` (list[re.Pattern]) | 합격 자소서 분석 | `achievement_score` 계산 |
| `CAUSE_ANALYSIS_WORDS` (frozenset) | 논리적 사고 평가 | `cause_analysis_count` 계산 |
| `ALTERNATIVE_WORDS` (frozenset) | 문제해결 평가 | `alternative_count` 계산 |

### 측정 함수 알고리즘

| 함수 | 알고리즘 | 정규화 |
|------|----------|--------|
| `_calc_specificity` | SPECIFICITY_PATTERNS 매치 수 집계 (중복 제거) | `min(count/3, 1.0)` |
| `_calc_achievement` | ACHIEVEMENT_PATTERNS 매치 수 집계 | `min(count/2, 1.0)` |
| `_calc_star` | S/T/A/R 요소별 존재 여부 + Action 2배 가중 | `가중합/5.0` |
| `_calc_vague_ratio` | `VAGUE_WORDS` 매칭 토큰 / 전체 토큰 | 0.0~1.0 직접 비율 |
| `_count_agency_verbs` | `AGENCY_VERB_STEMS` 어간 매칭 횟수 합산 | 정수 그대로 |
| `_count_cause_analysis` | `CAUSE_ANALYSIS_WORDS` 어구 매칭 횟수 | 정수 그대로 |
| `_count_alternatives` | `ALTERNATIVE_WORDS` 어구 매칭 횟수 | 정수 그대로 |

### 구현 순서

```
1-1. keywords.py          ← 외부 의존 없는 순수 상수 먼저
1-2. text_analyzer.py     ← keywords에만 의존
1-3. __init__.py          ← public API 노출
1-4. tests/unit/analyzers/test_text_analyzer.py  ← TDD: Red 먼저
```

---

## Phase 2: 스키마 변경 (schemas.py)

> 상세 설계: `sections/02_schema_rubric_design.md`

### FeedbackType 변경

```python
# Before
FeedbackType = Literal["strength", "improvement"]

# After
FeedbackType = Literal["strength", "improvement", "not_evaluated"]
```

### AxisScores — nullable 변경

```python
class AxisScores(BaseModel):
    communication:   int | None = Field(None, ge=0, le=100)
    problemSolving:  int | None = Field(None, ge=0, le=100)
    logicalThinking: int | None = Field(None, ge=0, le=100)
    jobExpertise:    int | None = Field(None, ge=0, le=100)
    cultureFit:      int | None = Field(None, ge=0, le=100)
    leadership:      int | None = Field(None, ge=0, le=100)
    creativity:      int | None = Field(None, ge=0, le=100)
    sincerity:       int | None = Field(None, ge=0, le=100)
```

### AxisFeedback — score nullable + signals 추가

```python
class AxisFeedback(BaseModel):
    axis:      str
    axisLabel: str
    score:     int | None = Field(None, ge=0, le=100)
    type:      FeedbackType   # "strength" | "improvement" | "not_evaluated"
    feedback:  str
    signals:   dict | None = None   # TextSignals 기반 근거 (선택)
```

---

## Phase 3: 8축 루브릭 v2

> 상세 설계: `sections/02_schema_rubric_design.md` § 2

### 루브릭 요약표

| 축 | 주요 신호 | 점수 공식 | not_evaluated 조건 |
|----|-----------|-----------|-------------------|
| **communication** | `star_score`, `vague_ratio`, `answer_length` | `star*60 + (1-vague)*40 - 길이보정` | `has_content=False` |
| **leadership** | `agency_verb_count` | `min(count*20, 100)` + 보정 | `has_content=False` |
| **problemSolving** | `cause_analysis_count`, `alternative_count` | `(cause+alt)*20 + spec*40` | `has_content=False` |
| **logicalThinking** | `star_score(T+A)`, `cause_analysis_count` | `star*50 + cause*30 + spec*20` | `has_content=False` |
| **jobExpertise** | `specificity_score`, `achievement_score` | `spec*50 + achiev*50` | `has_content=False` |
| **cultureFit** | `agency_verb_count`, `vague_ratio` | `agency*30 + star(T)*30 + (1-vague)*40` | `has_content=False` |
| **creativity** | `alternative_count`, `achievement_score` | `alt*50 + achiev*50` | `has_content=False` |
| **sincerity** | `star_score(S+T)`, `answer_length` | `star*40 + length보정*60` | `has_content=False` |

### totalScore 재계산 로직

```python
# not_evaluated 축 제외하고 평균 계산
evaluated_scores = [s for s in score_values.values() if s is not None]
total_score = round(sum(evaluated_scores) / len(evaluated_scores)) if evaluated_scores else 0
```

### 프롬프트 전략 (report_evaluation_v2.md)

- LLM에게 TextSignals 요약 + 규칙 기반 점수를 전달
- LLM은 **피드백 텍스트(axisFeedbacks[].feedback)만** 생성
- 점수는 서버에서 이미 계산 완료 → LLM이 점수를 바꾸지 못하도록 지시
- `report_evaluation_v1.md` 보존 (버전 이력 유지)

---

## Phase 4: 서비스 레이어 통합

> 상세 설계: `sections/01_analyzers_design.md` § 5

### report_service.py 변경

```python
from app.analyzers import analyze, TextSignals

def generate_report(resumeText, history):
    # 1. 각 답변 분석 (결정론적)
    signals_list = [analyze(item.answer) for item in history]

    # 2. 루브릭 적용 → 점수 계산 (결정론적)
    axis_scores = _apply_rubric(signals_list)

    # 3. LLM 호출: 점수 + signals 컨텍스트로 피드백 텍스트만 생성
    prompt = _build_prompt_v2(resumeText, history, axis_scores, signals_list)
    result = call_llm(prompt, ...)

    # 4. 응답 조합
    return _parse_report_v2(result.content, axis_scores)
```

### interview_service.py — followup 규칙 분류

```python
from app.analyzers import analyze

def _classify_followup_type(answer: str) -> FollowupType:
    signals = analyze(answer)

    if signals.star_score < 0.4:
        return "CLARIFY"       # STAR 불완전 → 구체화 요청
    if signals.agency_verb_count == 0:
        return "CLARIFY"       # 주도성 미감지 → 행동 구체화
    if signals.vague_ratio > 0.03:   # VAGUE_RATIO_THRESHOLD (1000개 분석 기반)
        return "CHALLENGE"     # 모호 표현 과다 → 근거 요청
    if signals.cause_analysis_count == 0 and signals.alternative_count == 0:
        return "CHALLENGE"     # 논리적 분석 미감지
    return "EXPLORE"           # 충분한 답변 → 심화 탐색
```

---

## Phase 5-b: 합격 자소서 1000개 분석 — 임계값 데이터 보정

> 구현 중 추가된 작업 (원래 플랜에 없었음)

### 배경

루브릭 임계값(VAGUE_RATIO_THRESHOLD=0.15, HAS_CONTENT_MIN_CHARS=20 등)이 근거 없는 임의 수치였음. 합격 자소서 1000개를 보유하고 있어 실제 데이터로 보정 가능하다고 판단.

### 스크립트: `engine/scripts/analyze_accepted_resumes.py`

```
D:\project\T아카데미\python\mirai\포폴,이력서자료\pdfs_latest\pdfs_latest
→ fitz(PyMuPDF)로 텍스트 추출
→ 문단 단위(30자 이상) 분리
→ analyze() 적용
→ TextSignals 분포 통계 집계
→ scripts/analysis_output.json 저장
```

### 분석 결과 요약 (1000개 자소서, 2565개 단락)

| 지표 | mean | p25 | p50 | p75 | p90 |
|------|------|-----|-----|-----|-----|
| specificity_score | 0.465 | 0.0 | 0.333 | 1.0 | 1.0 |
| star_score | 0.623 | 0.4 | 0.6 | 0.8 | 1.0 |
| vague_ratio | 0.012 | 0.004 | 0.010 | 0.017 | 0.024 |
| agency_verb_count | 2.02 | 0 | 1 | 3 | 5 |
| cause_analysis_count | 0.34 | 0 | 0 | 1 | 1 |
| answer_length | 1183 | 999 | 1286 | 1466 | 1618 |

### 임계값 보정 결과

| 상수 | 기존 | 변경 | 근거 |
|------|------|------|------|
| `HAS_CONTENT_MIN_CHARS` | 20 | **50** | 합격 자소서 p10=481자, 면접 답변은 더 짧으므로 50자 설정 |
| `VAGUE_RATIO_THRESHOLD` | 0.15 | **0.03** | 합격 자소서 max=0.048 → 기존 0.15는 사실상 미발동 |
| `STAR_CLARIFY_THRESHOLD` | 0.4 | **0.4** | 합격 자소서 p25=0.4 → 유지 |

### 키워드 확장 결과

- `AGENCY_VERBS`: 20개 → **35개** (수행하다, 활용하다, 기여하다, 파악하다 등 빈도 300회 이상 추가)
- `STAR_KEYWORDS.task`: 9개 키워드 추가 (임무는, 목적은, 과제를, 역할을, 주어진 등) → 커버리지 49.5% → 향상
- `VAGUE_WORDS`: 꾸준히, 지속적으로 추가

---

## Phase 5: E2E 테스트

> 상세 설계: `sections/03_test_plan.md`

### 테스트 파일 목록

| 파일 | 신규/확장 | 목적 |
|------|-----------|------|
| `tests/unit/analyzers/__init__.py` | 신규 | 패키지 초기화 |
| `tests/unit/analyzers/test_text_analyzer.py` | 신규 | TextSignals 결정론·경계값·각 함수 |
| `tests/unit/services/test_report_service.py` | 확장 | not_evaluated 분기, signals 포함 검증 |
| `tests/integration/test_report_router.py` | 확장 | signals 필드·not_evaluated totalScore HTTP |
| `tests/integration/test_interview_router.py` | 확장 | followup 규칙 분류 결정론 |
| `tests/fixtures/sample_answers_not_evaluated.json` | 신규 | has_content=False 케이스 포함 |
| `tests/fixtures/sample_answers_high_score.json` | 신규 | 고득점 패턴 (STAR 완성 + 수치) |
| `tests/fixtures/sample_answers_low_score.json` | 신규 | 저득점 패턴 (모호 표현 + 수치 없음) |

### 핵심 테스트 케이스 요약

#### Unit — text_analyzer (신규, ~20개)
- 결정론: 동일 텍스트 5회 호출 → 동일 TextSignals
- `specificity_score`: 수치 포함/미포함 경계
- `star_score`: S+T+A+R=1.0, Action만=0.4, 빈문자열=0.0
- `vague_ratio`: 모호 표현 과다 텍스트 > 0.3
- `agency_verb_count`: NCS 동사 카운트
- `has_content`: 빈 문자열/공백만 → False

#### Unit — report_service 확장 (~5개 추가)
- has_content=False 축 → type="not_evaluated", score=None
- not_evaluated 제외 totalScore 계산 검증
- signals 필드 응답 포함 여부

#### Integration — /api/report/generate 확장 (~4개 추가)
- 정상 응답에 `signals` 필드 포함
- 짧은 답변 히스토리 → 해당 축 not_evaluated
- not_evaluated 제외 totalScore HTTP 응답 검증

#### Integration — /api/interview/followup 확장 (~4개 추가)
- 모호한 답변 → CLARIFY 반환
- 구체적 답변 → CHALLENGE 또는 EXPLORE
- 동일 입력 3회 → 동일 followupType (결정론 검증)

### 커버리지 목표

| 파일 | 목표 |
|------|------|
| `app/analyzers/text_analyzer.py` | 95%+ |
| `app/services/report_service.py` | 90%+ |
| `app/routers/report.py` | 85%+ |
| `app/routers/interview.py` | 85%+ |
| **전체** | **80%+** |

### pytest 실행 명령어

```bash
# engine 디렉터리에서 실행
cd engine

# 전체 테스트 + 커버리지
pytest tests/ -v --cov=app --cov-report=term-missing --cov-fail-under=80

# analyzers 단위 테스트만
pytest tests/unit/analyzers/ -v

# 통합 테스트만
pytest tests/integration/ -v -m asyncio
```

---

## 전체 구현 순서 (TDD 기반)

```
Phase 1: analyzers/ 모듈
  1-1. keywords.py 작성 (상수 정의)
  1-2. test_text_analyzer.py 작성 (Red — 실패하는 테스트 먼저)
  1-3. text_analyzer.py + __init__.py 구현 (Green)
  1-4. 리팩터링 (Refactor)

Phase 2: 스키마 변경
  2-1. schemas.py 수정 (FeedbackType, AxisScores, AxisFeedback)
  2-2. 기존 테스트 수정 (nullable score 대응)

Phase 3: 루브릭 + 서비스
  3-1. report_evaluation_v2.md 작성
  3-2. report_service.py 변경 (analyze() 호출, 루브릭 적용)
  3-3. test_report_service.py 확장 (not_evaluated, signals)

Phase 4: followup 규칙 분류
  4-1. interview_service.py 변경 (_classify_followup_type 추가)
  4-2. test_interview_router.py 확장 (결정론 검증)

Phase 5: 통합 테스트 + 커버리지 확인
  5-1. 픽스처 데이터 작성 (sample_answers_*.json)
  5-2. test_report_router.py 확장 (signals, not_evaluated)
  5-3. pytest --cov 실행 → 80% 이상 확인

Phase 6: .ai.md 최신화
  6-1. engine/.ai.md — analyzers/ 디렉터리 추가
  6-2. engine/app/.ai.md — 구조 업데이트
```

---

## 수정 파일 체크리스트

| 파일 | 변경 내용 | Phase | 상태 |
|------|-----------|-------|------|
| `engine/app/analyzers/__init__.py` | 신규 생성 | 1 | ✅ |
| `engine/app/analyzers/keywords.py` | 신규 생성 | 1 | ✅ |
| `engine/app/analyzers/text_analyzer.py` | 신규 생성 | 1 | ✅ |
| `engine/app/schemas.py` | FeedbackType + AxisScores/AxisFeedback nullable | 2 | ✅ |
| `engine/app/prompts/report_evaluation_v2.md` | 신규 생성 (v1 보존) | 3 | ✅ |
| `engine/app/services/report_service.py` | analyze() 호출 + 루브릭 + not_evaluated | 3 | ✅ |
| `engine/app/services/interview_service.py` | _classify_followup_type 추가 | 4 | ✅ |
| `engine/tests/unit/analyzers/__init__.py` | 신규 생성 | 1 | ✅ |
| `engine/tests/unit/analyzers/test_text_analyzer.py` | 신규 생성 | 1 | ✅ |
| `engine/tests/unit/services/test_report_service.py` | 확장 | 3 | ✅ |
| `engine/tests/integration/test_report_router.py` | 확장 | 5 | ✅ |
| `engine/tests/integration/test_interview_router.py` | 확장 | 4 | ✅ |
| `engine/tests/fixtures/sample_answers_*.json` | 신규 생성 (3개) | 5 | ⏭️ 인라인 데이터로 대체 |
| `engine/.ai.md` | analyzers/ 디렉터리 추가 | 6 | ✅ |
| `engine/app/.ai.md` | 구조 업데이트 | 6 | ✅ |
