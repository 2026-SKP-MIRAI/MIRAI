# 02. 스키마 + 루브릭 변경 설계

> 이슈 #197 — TextSignals 기반 규칙 엔진 도입에 따른 schemas.py / report_service.py / 프롬프트 변경 상세

---

## 1. schemas.py 변경 diff

### 1-1. FeedbackType 변경

**Before:**
```python
FeedbackType = Literal["strength", "improvement"]
```

**After:**
```python
FeedbackType = Literal["strength", "improvement", "not_evaluated"]
```

### 1-2. AxisScores nullable 변경

**Before:**
```python
class AxisScores(BaseModel):
    communication:   int = Field(..., ge=0, le=100)
    problemSolving:  int = Field(..., ge=0, le=100)
    logicalThinking: int = Field(..., ge=0, le=100)
    jobExpertise:    int = Field(..., ge=0, le=100)
    cultureFit:      int = Field(..., ge=0, le=100)
    leadership:      int = Field(..., ge=0, le=100)
    creativity:      int = Field(..., ge=0, le=100)
    sincerity:       int = Field(..., ge=0, le=100)
```

**After:**
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

**변경 근거:** `not_evaluated` 축은 점수가 존재하지 않으므로 `None`으로 표현. Pydantic v2에서 `int | None`은 JSON `null`로 직렬화됨.

### 1-3. AxisFeedback signals 필드 추가

**Before:**
```python
class AxisFeedback(BaseModel):
    axis:      str
    axisLabel: str
    score:     int = Field(..., ge=0, le=100)
    type:      FeedbackType
    feedback:  str
```

**After:**
```python
class AxisFeedback(BaseModel):
    axis:      str
    axisLabel: str
    score:     int | None = Field(None, ge=0, le=100)
    type:      FeedbackType  # "strength" | "improvement" | "not_evaluated"
    feedback:  str
    signals:   dict | None = None  # TextSignals 기반 근거 데이터 (선택)
```

**변경 근거:**
- `score`: `not_evaluated`일 때 `None` 반환 (점수 산출 불가)
- `signals`: 프론트엔드에서 근거 데이터를 표시할 수 있도록 선택적 필드 추가. TextSignals의 해당 축 관련 값만 포함.

### 1-4. ReportResponse 변경

**Before:**
```python
class ReportResponse(BaseModel):
    scores:        AxisScores
    totalScore:    int = Field(..., ge=0, le=100)
    summary:       str
    axisFeedbacks: list[AxisFeedback] = Field(..., min_length=8, max_length=8)
    growthCurve:   None = None
    usage:         UsageMetadata | None = None
```

**After:**
```python
class ReportResponse(BaseModel):
    scores:        AxisScores
    totalScore:    int = Field(..., ge=0, le=100)
    # totalScore 계산: not_evaluated(None) 축 제외 평균
    summary:       str
    axisFeedbacks: list[AxisFeedback] = Field(..., min_length=8, max_length=8)
    growthCurve:   None = None
    usage:         UsageMetadata | None = None
```

**변경 포인트:** `ReportResponse` 스키마 자체는 동일하나, `totalScore` 계산 로직이 `report_service.py`에서 변경됨 (섹션 4 참조).

---

## 2. 8축 루브릭 상세표

TextSignals 필드 참조:

| 필드 | 타입 | 설명 |
|------|------|------|
| `specificity_score` | float 0.0~1.0 | 수치 구체성 (SPECIFICITY_PATTERNS) |
| `achievement_score` | float 0.0~1.0 | 정량적 성과 (ACHIEVEMENT_PATTERNS) |
| `star_score` | float 0.0~1.0 | STAR 구조 완성도 (S/T/A/R 4요소, Action 2배 가중) |
| `vague_ratio` | float 0.0~1.0 | 모호 표현 비율 (낮을수록 좋음) |
| `agency_verb_count` | int | 주도성 동사 출현 횟수 |
| `cause_analysis_count` | int | 원인 분석 표현 횟수 |
| `alternative_count` | int | 대안 고려 표현 횟수 |
| `has_content` | bool | 답변 존재 여부 (False -> not_evaluated) |

### 2-1. communication (의사소통)

주요 신호: `star_score`, `vague_ratio`, `answer_length`

| 점수 구간 | 조건 | 근거 |
|-----------|------|------|
| 90~100 | `star_score >= 0.8` (4/4 이상) AND `vague_ratio < 0.05` | STAR 완전 구조 + 모호 표현 거의 없음 = 명확한 의사소통 |
| 75~89 | `star_score >= 0.6` (3/4) OR (`answer_length >= 100` AND `vague_ratio < 0.10`) | STAR 대부분 구비 또는 충분한 분량 + 낮은 모호성 |
| 50~74 | `star_score <= 0.4` (2/4 이하) OR `vague_ratio > 0.30` | STAR 미흡 또는 모호 표현 과다 |
| 0~49 | `star_score == 0.0` (0/4) OR `answer_length < 20` | STAR 구조 부재 또는 답변 극히 짧음 |
| not_evaluated | `has_content == False` | 답변 없음 |

**세부 점수 공식:**
```python
if not has_content:
    return None, "not_evaluated"

# 기본점수 = star_score * 60 + (1 - vague_ratio) * 40
base = star_score * 60 + (1 - vague_ratio) * 40

# answer_length 보정: 100자 미만이면 감점 (최대 -15점)
if answer_length < 100:
    base -= max(0, (100 - answer_length) / 100 * 15)

score = clamp(round(base), 0, 100)
type = "strength" if score >= 75 else "improvement"
```

### 2-2. leadership (리더십)

주요 신호: `agency_verb_count`, `specificity_score`

| 점수 구간 | 조건 | 근거 |
|-----------|------|------|
| 90~100 | `agency_verb_count >= 3` AND `specificity_score >= 0.5` | 다수의 주도성 동사 + 수치 근거 포함 (팀 규모 등) |
| 75~89 | `agency_verb_count >= 2` | NCS 행동지표 2개 이상 매칭 |
| 50~74 | `agency_verb_count == 1` | 주도성 표현 최소 1개 |
| 0~49 | `agency_verb_count == 0` | 주도성 동사 없음 |
| not_evaluated | `has_content == False` | 답변 없음 |

**세부 점수 공식:**
```python
if not has_content:
    return None, "not_evaluated"

# agency 기본: min(agency_verb_count, 5) / 5 * 70
base = min(agency_verb_count, 5) / 5 * 70

# specificity 보너스: specificity_score * 30
base += specificity_score * 30

score = clamp(round(base), 0, 100)
type = "strength" if score >= 75 else "improvement"
```

### 2-3. problemSolving (문제해결)

주요 신호: `cause_analysis_count`, `alternative_count`, `star_score`

| 점수 구간 | 조건 | 근거 |
|-----------|------|------|
| 90~100 | `cause_analysis_count >= 2` AND `alternative_count >= 2` AND `star_score >= 0.6` | 원인 분석 + 대안 검토 + 구조적 서술 |
| 75~89 | `cause_analysis_count >= 1` AND `alternative_count >= 1` | 원인 분석과 대안 모두 1회 이상 |
| 50~74 | `cause_analysis_count >= 1` OR `alternative_count >= 1` | 원인 분석 또는 대안 중 하나만 존재 |
| 0~49 | `cause_analysis_count == 0` AND `alternative_count == 0` | 문제 분석 시도 없음 |
| not_evaluated | `has_content == False` | 답변 없음 |

**세부 점수 공식:**
```python
if not has_content:
    return None, "not_evaluated"

# 원인분석: min(cause_analysis_count, 3) / 3 * 35
cause_part = min(cause_analysis_count, 3) / 3 * 35

# 대안검토: min(alternative_count, 3) / 3 * 35
alt_part = min(alternative_count, 3) / 3 * 35

# STAR 구조 보너스: star_score * 30
star_part = star_score * 30

score = clamp(round(cause_part + alt_part + star_part), 0, 100)
type = "strength" if score >= 75 else "improvement"
```

### 2-4. logicalThinking (논리적 사고)

주요 신호: `star_score` (T+A 가중), `cause_analysis_count`

| 점수 구간 | 조건 | 근거 |
|-----------|------|------|
| 90~100 | `star_score >= 0.8` AND `cause_analysis_count >= 2` | 완전한 논리 구조 + 충분한 인과 연결 |
| 75~89 | `star_score >= 0.6` AND `cause_analysis_count >= 1` | 대체로 논리적 + 인과 연결 1회 이상 |
| 50~74 | `star_score >= 0.4` OR `cause_analysis_count >= 1` | 논리 구조 일부 또는 인과 연결 존재 |
| 0~49 | `star_score < 0.4` AND `cause_analysis_count == 0` | 논리 구조 미흡 + 인과 분석 없음 |
| not_evaluated | `has_content == False` | 답변 없음 |

**세부 점수 공식:**
```python
if not has_content:
    return None, "not_evaluated"

# STAR(T+A 강조) — Task, Action 요소가 논리 뼈대
# star_score는 이미 Action 2배 가중이므로 그대로 활용
star_part = star_score * 50

# 인과 분석: min(cause_analysis_count, 4) / 4 * 40
cause_part = min(cause_analysis_count, 4) / 4 * 40

# 모호성 감점: vague_ratio > 0.2이면 최대 -10
vague_penalty = max(0, (vague_ratio - 0.2) * 50) if vague_ratio > 0.2 else 0

score = clamp(round(star_part + cause_part + 10 - vague_penalty), 0, 100)
# +10: 기본 베이스라인 (최소한의 답변 존재 가산)
type = "strength" if score >= 75 else "improvement"
```

### 2-5. jobExpertise (직무 전문성)

주요 신호: `specificity_score`, `achievement_score`

| 점수 구간 | 조건 | 근거 |
|-----------|------|------|
| 90~100 | `specificity_score >= 0.7` AND `achievement_score >= 0.5` | 높은 수치 구체성 + 정량적 성과 다수 |
| 75~89 | `specificity_score >= 0.4` AND `achievement_score >= 0.3` | 구체적 수치 + 성과 표현 존재 |
| 50~74 | `specificity_score >= 0.2` OR `achievement_score >= 0.1` | 수치 일부 또는 성과 표현 최소 |
| 0~49 | `specificity_score < 0.2` AND `achievement_score < 0.1` | 구체성 부족, 성과 표현 없음 |
| not_evaluated | `has_content == False` | 답변 없음 |

**세부 점수 공식:**
```python
if not has_content:
    return None, "not_evaluated"

# 수치 구체성: specificity_score * 50
spec_part = specificity_score * 50

# 성과 표현: achievement_score * 40
ach_part = achievement_score * 40

# 기본 베이스라인
base = 10

score = clamp(round(spec_part + ach_part + base), 0, 100)
type = "strength" if score >= 75 else "improvement"
```

### 2-6. cultureFit (조직 적합성)

주요 신호: `agency_verb_count` (중간 수준), `vague_ratio`, `star_score`

| 점수 구간 | 조건 | 근거 |
|-----------|------|------|
| 90~100 | `agency_verb_count >= 2` AND `vague_ratio < 0.05` AND `star_score >= 0.6` | 협업 동사 풍부 + 구체적 서술 + 구조적 |
| 75~89 | `agency_verb_count >= 1` AND `vague_ratio < 0.15` | 협업 표현 있고 모호성 낮음 |
| 50~74 | `agency_verb_count >= 1` OR `vague_ratio < 0.20` | 협업 표현 최소 또는 모호성 보통 |
| 0~49 | `agency_verb_count == 0` AND `vague_ratio >= 0.20` | 협업 표현 없음 + 모호 표현 과다 |
| not_evaluated | `has_content == False` | 답변 없음 |

**세부 점수 공식:**
```python
if not has_content:
    return None, "not_evaluated"

# 협업 동사 (agency의 팀워크 부분): min(agency_verb_count, 4) / 4 * 40
agency_part = min(agency_verb_count, 4) / 4 * 40

# 비모호성 (구체적 협업 서술): (1 - vague_ratio) * 30
clarity_part = (1 - vague_ratio) * 30

# STAR 구조 (협업 맥락 서술): star_score * 20
star_part = star_score * 20

# 기본 베이스라인
base = 10

score = clamp(round(agency_part + clarity_part + star_part + base), 0, 100)
type = "strength" if score >= 75 else "improvement"
```

### 2-7. creativity (창의성)

주요 신호: `alternative_count`, `achievement_score`

| 점수 구간 | 조건 | 근거 |
|-----------|------|------|
| 90~100 | `alternative_count >= 3` AND `achievement_score >= 0.3` | 다양한 대안 검토 + 성과로 입증 |
| 75~89 | `alternative_count >= 2` OR (`alternative_count >= 1` AND `achievement_score >= 0.3`) | 대안 2개 이상 또는 대안+성과 조합 |
| 50~74 | `alternative_count >= 1` | 대안적 사고 최소 1회 |
| 0~49 | `alternative_count == 0` | 대안적 사고 표현 없음 |
| not_evaluated | `has_content == False` | 답변 없음 |

**세부 점수 공식:**
```python
if not has_content:
    return None, "not_evaluated"

# 대안 사고: min(alternative_count, 4) / 4 * 50
alt_part = min(alternative_count, 4) / 4 * 50

# 성과 입증: achievement_score * 30
ach_part = achievement_score * 30

# specificity 보너스: specificity_score * 10
spec_bonus = specificity_score * 10

# 기본 베이스라인
base = 10

score = clamp(round(alt_part + ach_part + spec_bonus + base), 0, 100)
type = "strength" if score >= 75 else "improvement"
```

### 2-8. sincerity (성실성)

주요 신호: `star_score` (S+T 요소), `answer_length`

| 점수 구간 | 조건 | 근거 |
|-----------|------|------|
| 90~100 | `star_score >= 0.6` (S+T 존재) AND `answer_length >= 200` | 상황/과제 맥락 서술 + 충분한 분량 = 준비성 |
| 75~89 | `star_score >= 0.4` AND `answer_length >= 100` | STAR 일부 + 적정 분량 |
| 50~74 | `answer_length >= 50` | 최소한의 답변 분량 |
| 0~49 | `answer_length < 50` | 답변 분량 극히 부족 |
| not_evaluated | `has_content == False` | 답변 없음 |

**세부 점수 공식:**
```python
if not has_content:
    return None, "not_evaluated"

# STAR(S+T) 준비성: star_score * 40
star_part = star_score * 40

# 답변 분량: min(answer_length, 300) / 300 * 35
length_part = min(answer_length, 300) / 300 * 35

# 비모호성 (진정성 있는 서술): (1 - vague_ratio) * 15
clarity_part = (1 - vague_ratio) * 15

# 기본 베이스라인
base = 10

score = clamp(round(star_part + length_part + clarity_part + base), 0, 100)
type = "strength" if score >= 75 else "improvement"
```

---

## 3. not_evaluated 판정 로직

### 3-1. 판정 기준

`not_evaluated`는 "해당 축을 평가할 수 있는 콘텐츠가 존재하지 않는 경우"에 적용된다.

**1차 판정: `has_content` 기반 (전체 답변 수준)**

```python
# text_analyzer.has_content()
def has_content(text: str, min_chars: int = 20) -> bool:
    if not text:
        return False
    return len(text.strip()) >= min_chars
```

- `has_content == False` -> 해당 답변의 **모든 축**이 `not_evaluated`
- 공백 제거 후 20자 미만 = 유효 답변 없음

**2차 판정: 축별 콘텐츠 부재 (향후 확장)**

현재는 `has_content`가 전체 답변 단위로만 동작한다. 축별로 관련 질문이 없었을 경우의 판정은 면접 히스토리 분석을 통해 구현할 수 있으나, v2 초기 단계에서는 `has_content` 단일 기준으로 시작한다.

### 3-2. not_evaluated 시 출력

```python
# not_evaluated 축의 AxisFeedback
AxisFeedback(
    axis="leadership",
    axisLabel="리더십",
    score=None,          # 점수 없음
    type="not_evaluated",
    feedback="해당 역량을 평가할 수 있는 답변이 충분하지 않습니다.",
    signals=None,
)

# not_evaluated 축의 AxisScores
AxisScores(
    communication=85,
    problemSolving=72,
    logicalThinking=None,  # not_evaluated
    # ...
)
```

---

## 4. report_service.py 변경 상세

### 4-1. _parse_report 변경

**Before (현재 코드):**
```python
def _parse_report(raw: str) -> ReportResponse:
    # ...
    # scores 파싱 (축 누락 시 50점 fallback)
    raw_scores = data.get("scores", {}) if isinstance(data.get("scores"), dict) else {}
    score_values = {key: _clamp(raw_scores.get(key, 50)) for key, _ in AXIS_KEYS}
    scores = AxisScores(**score_values)

    # totalScore = 8개 평균 (정수 반올림)
    total_score = round(sum(score_values.values()) / len(AXIS_KEYS))
    total_score = _clamp(total_score)

    # ...
    for fb in raw_feedbacks:
        score = _clamp(fb.get("score", 50))
        # type 강제 보정: score >= 75이면 strength, 미만이면 improvement
        fb_type = "strength" if score >= 75 else "improvement"
        # ...
```

**After (v2 코드):**
```python
def _parse_report(raw: str, signals_per_axis: dict[str, dict] | None = None) -> ReportResponse:
    # ...
    # scores 파싱 — not_evaluated면 None
    raw_scores = data.get("scores", {}) if isinstance(data.get("scores"), dict) else {}
    score_values = {}
    for key, _ in AXIS_KEYS:
        raw_val = raw_scores.get(key)
        if raw_val is None:
            score_values[key] = None  # not_evaluated
        else:
            score_values[key] = _clamp(raw_val)
    scores = AxisScores(**score_values)

    # totalScore = not_evaluated 제외 평균
    evaluated = [s for s in score_values.values() if s is not None]
    total_score = _clamp(round(sum(evaluated) / len(evaluated))) if evaluated else 0

    # ...
    for fb in raw_feedbacks:
        axis = str(fb.get("axis", ""))
        axis_label = str(fb.get("axisLabel", ""))
        raw_score = fb.get("score")

        if raw_score is None:
            # not_evaluated
            fb_score = None
            fb_type = "not_evaluated"
        else:
            fb_score = _clamp(raw_score)
            fb_type = "strength" if fb_score >= 75 else "improvement"

        feedback_text = str(fb.get("feedback", ""))

        # signals 주입 (있으면)
        axis_signals = signals_per_axis.get(axis) if signals_per_axis else None

        axis_feedbacks.append(AxisFeedback(
            axis=axis,
            axisLabel=axis_label,
            score=fb_score,
            type=fb_type,
            feedback=feedback_text,
            signals=axis_signals,
        ))
    # ...
```

### 4-2. generate_report 변경

**Before:**
```python
def generate_report(
    resumeText: str,
    history: list[HistoryItem],
    *,
    model: str | None = None,
) -> tuple[ReportResponse, UsageMetadata | None]:
    # ...
    prompt = _build_prompt(resumeText, history)
    result = _call_llm(prompt, ...)
    return _parse_report(result.content), _usage_to_metadata(result.usage, result.model)
```

**After:**
```python
from app.analyzers.text_analyzer import analyze as analyze_text, TextSignals
from dataclasses import asdict

def generate_report(
    resumeText: str,
    history: list[HistoryItem],
    *,
    model: str | None = None,
) -> tuple[ReportResponse, UsageMetadata | None]:
    # ...

    # 1. TextSignals 분석 (규칙 엔진)
    all_answers = " ".join(item.answer for item in history)
    signals = analyze_text(all_answers)
    signals_dict = asdict(signals)

    # 2. signals를 축별로 매핑 (프론트엔드 표시용)
    signals_per_axis = {key: signals_dict for key, _ in AXIS_KEYS}

    # 3. 프롬프트 빌드 (v2: signals 포함)
    prompt = _build_prompt_v2(resumeText, history, signals)

    # 4. LLM 호출
    result = _call_llm(prompt, ...)

    # 5. 파싱 (signals 주입)
    return _parse_report(result.content, signals_per_axis), _usage_to_metadata(result.usage, result.model)
```

### 4-3. _build_prompt_v2 (신규)

```python
def _build_prompt_v2(
    resume_text: str,
    history: list[HistoryItem],
    signals: TextSignals,
) -> str:
    prompt_template = (PROMPT_DIR / "report_evaluation_v2.md").read_text(encoding="utf-8")
    history_lines = []
    for i, item in enumerate(history, 1):
        history_lines.append(f"[{i}] {item.personaLabel} ({item.persona})")
        history_lines.append(f"Q: {item.question}")
        history_lines.append(f"A: {item.answer}")
        history_lines.append("")
    history_text = "\n".join(history_lines)

    # TextSignals를 JSON으로 직렬화
    signals_json = json.dumps(asdict(signals), ensure_ascii=False, indent=2)

    return (
        prompt_template
        .replace("{resume_text}", resume_text[:16000])
        .replace("{history_text}", history_text)
        .replace("{signals_json}", signals_json)
    )
```

---

## 5. report_evaluation_v2.md 프롬프트 전체

```markdown
당신은 채용 전문가입니다. 아래 지원자의 자기소개서와 면접 답변 기록, 그리고 **텍스트 분석 신호(TextSignals)**를 바탕으로 8개 역량 축별 정량 점수와 피드백을 생성하세요.

## 자기소개서
{resume_text}

## 면접 답변 기록
{history_text}

## 텍스트 분석 신호 (TextSignals)
아래는 규칙 기반 텍스트 분석 엔진이 면접 답변에서 추출한 정량적 신호입니다.
**점수 산출의 핵심 근거**로 활용하세요. 당신의 역할은 이 신호를 "설명"하는 것입니다.

```json
{signals_json}
```

### 신호 해석 가이드
- `specificity_score` (0.0~1.0): 수치·데이터 구체성. 높을수록 구체적.
- `achievement_score` (0.0~1.0): 정량적 성과 표현. "30% 향상" 같은 패턴.
- `star_score` (0.0~1.0): STAR 구조 완성도. Action 가중 2배.
- `vague_ratio` (0.0~1.0): 모호 표현 비율. **낮을수록** 좋음.
- `agency_verb_count` (int): 주도성 동사 횟수. "이끌다, 주도하다, 제안하다" 등.
- `cause_analysis_count` (int): 원인 분석 표현 횟수. "왜냐하면, 따라서" 등.
- `alternative_count` (int): 대안 고려 표현 횟수. "대안, 다른 방법, 검토했" 등.
- `has_content` (bool): 답변 존재 여부. false이면 **모든 축 not_evaluated**.

## 평가 기준 (8개 역량 축) — TextSignals 기반 루브릭

각 축의 점수를 산출할 때 아래 루브릭을 따르세요. **TextSignals 수치가 1차 근거**이고, 답변 내용 해석은 2차 근거입니다.

### 1. communication (의사소통)
- 핵심 신호: star_score, vague_ratio, 답변 길이
- 90~100: star_score >= 0.8 AND vague_ratio < 0.05
- 75~89: star_score >= 0.6 OR (답변 100자+ AND vague_ratio < 0.10)
- 50~74: star_score <= 0.4 OR vague_ratio > 0.30
- 0~49: star_score == 0 OR 답변 20자 미만
- has_content=false → score: null, type: "not_evaluated"

### 2. problemSolving (문제해결)
- 핵심 신호: cause_analysis_count, alternative_count, star_score
- 90~100: cause_analysis >= 2 AND alternative >= 2 AND star_score >= 0.6
- 75~89: cause_analysis >= 1 AND alternative >= 1
- 50~74: cause_analysis >= 1 OR alternative >= 1
- 0~49: cause_analysis == 0 AND alternative == 0
- has_content=false → not_evaluated

### 3. logicalThinking (논리적 사고)
- 핵심 신호: star_score (T+A 가중), cause_analysis_count
- 90~100: star_score >= 0.8 AND cause_analysis >= 2
- 75~89: star_score >= 0.6 AND cause_analysis >= 1
- 50~74: star_score >= 0.4 OR cause_analysis >= 1
- 0~49: star_score < 0.4 AND cause_analysis == 0
- has_content=false → not_evaluated

### 4. jobExpertise (직무 전문성)
- 핵심 신호: specificity_score, achievement_score
- 90~100: specificity >= 0.7 AND achievement >= 0.5
- 75~89: specificity >= 0.4 AND achievement >= 0.3
- 50~74: specificity >= 0.2 OR achievement >= 0.1
- 0~49: specificity < 0.2 AND achievement < 0.1
- has_content=false → not_evaluated

### 5. cultureFit (조직 적합성)
- 핵심 신호: agency_verb_count, vague_ratio, star_score
- 90~100: agency >= 2 AND vague_ratio < 0.05 AND star_score >= 0.6
- 75~89: agency >= 1 AND vague_ratio < 0.15
- 50~74: agency >= 1 OR vague_ratio < 0.20
- 0~49: agency == 0 AND vague_ratio >= 0.20
- has_content=false → not_evaluated

### 6. leadership (리더십)
- 핵심 신호: agency_verb_count, specificity_score
- 90~100: agency >= 3 AND specificity >= 0.5
- 75~89: agency >= 2
- 50~74: agency == 1
- 0~49: agency == 0
- has_content=false → not_evaluated

### 7. creativity (창의성)
- 핵심 신호: alternative_count, achievement_score
- 90~100: alternative >= 3 AND achievement >= 0.3
- 75~89: alternative >= 2 OR (alternative >= 1 AND achievement >= 0.3)
- 50~74: alternative >= 1
- 0~49: alternative == 0
- has_content=false → not_evaluated

### 8. sincerity (성실성)
- 핵심 신호: star_score (S+T), 답변 길이
- 90~100: star_score >= 0.6 AND 답변 200자+
- 75~89: star_score >= 0.4 AND 답변 100자+
- 50~74: 답변 50자+
- 0~49: 답변 50자 미만
- has_content=false → not_evaluated

## 출력 규칙
- 반드시 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.
- 모든 점수는 0-100 정수로 표현하세요. not_evaluated면 null.
- `score >= 75`이면 `type: "strength"`, `score < 75`이면 `type: "improvement"`, `score == null`이면 `type: "not_evaluated"`
- `type: "strength"`: 구체적 칭찬 1-2문장 (어떤 답변에서 강점이 드러났는지 + TextSignals 근거 명시)
- `type: "improvement"`: 바로 실천 가능한 행동 개선 문장 1-2문장 (구체적 방법 제시)
- `type: "not_evaluated"`: "해당 역량을 평가할 수 있는 답변이 충분하지 않습니다."
- `axisFeedbacks`는 반드시 8개 항목을 모두 포함해야 합니다.
- `totalScore`는 not_evaluated(null)이 아닌 축만의 평균을 정수로 반올림한 값입니다.
- `summary`는 지원자의 전반적인 인상을 2-3문장으로 한국어로 작성하세요.

## 출력 형식
```json
{
  "scores": {
    "communication": 80,
    "problemSolving": 72,
    "logicalThinking": null,
    "jobExpertise": 65,
    "cultureFit": 82,
    "leadership": 70,
    "creativity": 68,
    "sincerity": 90
  },
  "totalScore": 75,
  "summary": "지원자는 전반적으로 성실하고 협업 능력이 뛰어납니다. 직무 전문성과 창의성 측면에서 성장 가능성을 보여주었습니다. 논리적 사고는 평가 가능한 답변이 부족했습니다.",
  "axisFeedbacks": [
    {
      "axis": "communication",
      "axisLabel": "의사소통",
      "score": 80,
      "type": "strength",
      "feedback": "STAR 구조(star_score 0.8)를 활용한 명확한 답변 구성이 돋보입니다. 모호 표현 비율(vague_ratio 0.03)이 매우 낮아 정확한 의사소통 능력을 보여주었습니다."
    },
    {
      "axis": "logicalThinking",
      "axisLabel": "논리적 사고",
      "score": null,
      "type": "not_evaluated",
      "feedback": "해당 역량을 평가할 수 있는 답변이 충분하지 않습니다."
    }
  ]
}
```

위 형식을 참고하여 실제 면접 내용과 TextSignals 수치에 맞는 평가를 작성하세요. JSON만 출력하세요.
```

---

## 6. 하위 호환성

### 6-1. v1 프롬프트 보존 방법

`report_evaluation_v1.md`는 삭제하지 않고 그대로 유지한다.

```
engine/app/prompts/
  report_evaluation_v1.md   # 기존 (보존)
  report_evaluation_v2.md   # 신규 (TextSignals 기반)
```

`report_service.py`에서 프롬프트 선택:

```python
def _build_prompt(resume_text: str, history: list[HistoryItem]) -> str:
    """v1 프롬프트 — TextSignals 없이 LLM 자체 판단"""
    prompt_template = (PROMPT_DIR / "report_evaluation_v1.md").read_text(encoding="utf-8")
    # ... (기존 코드 그대로)

def _build_prompt_v2(resume_text: str, history: list[HistoryItem], signals: TextSignals) -> str:
    """v2 프롬프트 — TextSignals 주입"""
    prompt_template = (PROMPT_DIR / "report_evaluation_v2.md").read_text(encoding="utf-8")
    # ... (새 코드)
```

전환 시점에는 `generate_report`에서 v2를 기본으로 호출하되, 환경 변수나 feature flag로 v1 fallback이 가능하도록 구성할 수 있다.

### 6-2. ReportResponse 기존 클라이언트 영향 분석

| 필드 | v1 타입 | v2 타입 | 영향 |
|------|---------|---------|------|
| `AxisScores.*` | `int` (필수) | `int \| None` | **Breaking**: 클라이언트가 `null` 처리 필요 |
| `AxisFeedback.score` | `int` (필수) | `int \| None` | **Breaking**: `null` 처리 필요 |
| `AxisFeedback.type` | `"strength" \| "improvement"` | `+ "not_evaluated"` | **Breaking**: 새 타입 처리 필요 |
| `AxisFeedback.signals` | (없음) | `dict \| None` | **Non-breaking**: 새 선택 필드, 무시 가능 |
| `ReportResponse.totalScore` | 8축 평균 | 평가된 축만 평균 | **Semantic change**: 값 범위 동일, 계산 방식 변경 |

**프론트엔드 대응 필요 사항:**

1. **점수 표시**: `score === null`이면 "평가 불가" 또는 "-" 표시
2. **차트/그래프**: `null` 축은 비활성 표시 또는 제외
3. **타입 분기**: `not_evaluated` 타입에 대한 UI 처리 (회색 처리 등)
4. **totalScore 툴팁**: "평가된 N개 축 평균" 안내

**마이그레이션 전략:**

1. 프론트엔드에서 먼저 `null` / `not_evaluated` 방어 코드 추가 (v1에서는 발생하지 않으므로 무해)
2. 엔진 v2 배포
3. 순서를 지키면 다운타임 없이 전환 가능
