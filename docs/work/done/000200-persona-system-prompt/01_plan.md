# [#200] feat: [engine] 기능03 페르소나 System Prompt 강화 + 압박도 adaptive 조절 — 구현 계획

> 작성: 2026-03-24 | 모드: RALPLAN-DR (consensus, v2 — Critic APPROVE)

---

## 완료 기준

- [ ] 페르소나별 System Prompt 분리 강화 — HR·기술팀장·경영진 각각 독립 프롬프트 파일
- [ ] 동일 답변에 HR·기술팀장·경영진이 서로 다른 다음 질문 생성 (검증 테스트 포함)
- [ ] answer_quality < 60 → CHALLENGE, vague_ratio > 0.04 → CLARIFY, else → EXPLORE 자동 전환
- [ ] 답변 신호 추출 후 해당 페르소나 관심 영역 기반 질문 유도
- [ ] pytest 커버리지 80% 이상

> **임계값 조정 근거**: 이슈 AC의 `vague_ratio > 0.4`는 text_analyzer 실측 범위(0~0.05, corpus max=0.0483)에서 절대 트리거 불가.
> 기존 `VAGUE_RATIO_THRESHOLD=0.03` 기반으로 corpus p90 수준인 `0.04`로 재조정.

---

## 구현 계획

### RALPLAN-DR Summary

#### Principles (5)

1. **결정론적 분류 유지**: pressure 분류(CLARIFY/CHALLENGE/EXPLORE)는 LLM이 아닌 규칙 기반으로 결정한다
2. **기존 프롬프트 구조 보존**: 기존 `interview_*_v2.md`(첫 질문 생성) 역할 유지. `interview_followup_v2.md`는 fallback으로 보존 (삭제 안 함)
3. **최소 침습 변경**: `interview_service.py`의 공개 API 시그니처를 변경하지 않는다
4. **실측 기반 임계값**: AC #3의 임계값은 text_analyzer의 실제 출력 범위에 맞게 조정
5. **테스트 가능성 우선**: 새로 추가하는 모든 모듈은 LLM 의존 없이 단위 테스트 가능해야 한다

#### Decision Drivers (top 3)

1. **vague_ratio 실측 범위 정합성**: corpus max=0.0483이므로 `0.04`(corpus p90 수준) 사용
2. **answer_quality 공식 명세**: `(star_score * 0.5 + specificity_score * 0.3 + achievement_score * 0.2) * 100`
3. **process_answer() 통합 경로**: `_check_followup()` 내부에서 신호/압박도를 페르소나별 프롬프트에 주입

#### 선택된 Option A: 페르소나별 followup 프롬프트 완전 분리 (3파일)
- `persona_hr_v1.md`, `persona_tech_v1.md`, `persona_exec_v1.md` 신규 생성
- 각 프롬프트가 `{persona_signals}`, `{pressure_type}`, `{question}`, `{answer}`, `{resume_text}` 플레이스홀더 포함
- **근거**: AC #1이 "각각 독립 프롬프트 파일"을 명시적으로 요구

---

### 변경 후 아키텍처

```
interview_service.py
  _check_followup(question, answer, persona, resumeText) [수정]
    → analyze(answer) -> TextSignals
    → classify_pressure(signals) -> "CLARIFY"|"CHALLENGE"|"EXPLORE"
    → format_persona_signals(answer, signals, persona) -> str
    → PERSONA_FOLLOWUP_PROMPTS.get(persona) or "interview_followup_v2.md" 로드
    → {persona_signals}, {pressure_type} 플레이스홀더 치환
    → LLM 호출

  _classify_followup_type(answer) [수정 — pressure_controller에 위임]
    → analyze(answer) -> TextSignals
    → classify_pressure(signals) -> FollowupType

pressure_controller.py [신규]
  calc_answer_quality(signals: TextSignals) -> float  # 0~100
  classify_pressure(signals: TextSignals) -> str  # CLARIFY|CHALLENGE|EXPLORE

answer_signals.py [신규, format_persona_signals()에 집중]
  format_persona_signals(answer, signals, persona) -> str
```

---

### Guardrails

**Must Have**
- 규칙 기반 pressure 분류 (LLM 미사용, 결정론적)
- 기존 `start_interview()`, `process_answer()`, `generate_followup()` 함수 시그니처 유지
- 기존 테스트 전부 통과 (regression 없음)
- 페르소나별 프롬프트 파일이 물리적으로 분리된 독립 .md 파일

**Must NOT Have**
- `text_analyzer.py` 수정 (기존 결정론적 엔진 불변)
- `keywords.py`의 기존 임계값 변경 (VAGUE_RATIO_THRESHOLD, STAR_CLARIFY_THRESHOLD)
- 새 API 엔드포인트 추가

---

### Step 1: `pressure_controller.py` — answer_quality 공식 + 압박도 분류

**파일**: `engine/app/analyzers/pressure_controller.py`

```python
"""압박도(pressure) 분류 모듈. LLM 미사용, 결정론적."""
from app.analyzers.text_analyzer import TextSignals

ANSWER_QUALITY_CHALLENGE_THRESHOLD: float = 60.0
VAGUE_RATIO_PRESSURE_THRESHOLD: float = 0.04  # corpus p90 기반


def calc_answer_quality(signals: TextSignals) -> float:
    """TextSignals → answer_quality (0~100).
    공식: (star_score * 0.5 + specificity_score * 0.3 + achievement_score * 0.2) * 100
    예시: star=0.4, spec=0.5, ach=0.3 → (0.20+0.15+0.06)*100 = 41.0 → CHALLENGE
    """
    return (
        signals.star_score * 0.5
        + signals.specificity_score * 0.3
        + signals.achievement_score * 0.2
    ) * 100


def classify_pressure(signals: TextSignals) -> str:
    """규칙 기반 followup 유형 분류 (결정론적).

    우선순위:
      1. has_content=False → "CLARIFY"
      2. vague_ratio > 0.04 → "CLARIFY"  (모호 답변)
      3. agency_verb_count == 0 → "CLARIFY"  (주도성 없음 — 기존 조건 보존)
      4. answer_quality < 60 → "CHALLENGE"
      5. else → "EXPLORE"
    """
    if not signals.has_content:
        return "CLARIFY"
    if signals.vague_ratio > VAGUE_RATIO_PRESSURE_THRESHOLD:
        return "CLARIFY"
    if signals.agency_verb_count == 0:        # 기존 _classify_followup_type 조건 보존
        return "CLARIFY"
    answer_quality = calc_answer_quality(signals)
    if answer_quality < ANSWER_QUALITY_CHALLENGE_THRESHOLD:
        return "CHALLENGE"
    return "EXPLORE"
```

> **Critic 권고 반영**: 기존 `_classify_followup_type()`의 `agency_verb_count == 0 → CLARIFY` 조건을 `classify_pressure()`에 명시적으로 포함. 회귀 방지.

**AC**:
- [ ] `classify_pressure(signals(star=0.3, spec=0.2, ach=0.1, vague=0.01, agency=1))` → `"CHALLENGE"` (quality=26)
- [ ] `classify_pressure(signals(vague=0.05, agency=1))` → `"CLARIFY"` (vague > 0.04)
- [ ] `classify_pressure(signals(star=0.8, spec=0.7, ach=0.6, vague=0.01, agency=1))` → `"EXPLORE"`
- [ ] `classify_pressure(signals(vague=0.01, agency=0))` → `"CLARIFY"` (agency_verb == 0)
- [ ] `calc_answer_quality(star=0.4, spec=0.5, ach=0.3)` == `41.0`
- [ ] 경계값: quality 정확히 60.0 → NOT CHALLENGE
- [ ] 결정론적: 동일 입력 → 항상 동일 출력

---

### Step 2: `answer_signals.py` — 페르소나별 신호 포맷팅

**파일**: `engine/app/analyzers/answer_signals.py`

```python
"""페르소나별 답변 신호 포맷팅 모듈. LLM 미사용, 결정론적."""
from app.analyzers.text_analyzer import TextSignals

TEAMWORK_KEYWORDS = ["협업", "팀", "소통", "배려", "조율", "합의", "갈등", "리더"]
TECHNICAL_KEYWORDS = ["설계", "아키텍처", "알고리즘", "최적화", "리팩토링", "디버깅", "배포", "CI/CD"]
BUSINESS_KEYWORDS = ["매출", "성과", "ROI", "임팩트", "전략", "비용", "효율", "KPI"]


def _keyword_score(text: str, keywords: list[str]) -> float:
    count = sum(1 for kw in keywords if kw in text)
    return min(count / 3.0, 1.0)


def format_persona_signals(answer: str, signals: TextSignals, persona: str) -> str:
    """페르소나별 관심 영역 신호 → 프롬프트 주입용 텍스트."""
    if persona == "hr":
        return (
            f"[HR 관심 신호]\n"
            f"- STAR 구조 완성도: {signals.star_score:.2f}/1.0\n"
            f"- 협업/소통 키워드 밀도: {_keyword_score(answer, TEAMWORK_KEYWORDS):.2f}/1.0\n"
            f"- 주도성 동사 수: {signals.agency_verb_count}개\n"
            f"- 구체성 점수: {signals.specificity_score:.2f}/1.0"
        )
    elif persona == "tech_lead":
        return (
            f"[기술팀장 관심 신호]\n"
            f"- 기술 깊이 키워드 밀도: {_keyword_score(answer, TECHNICAL_KEYWORDS):.2f}/1.0\n"
            f"- 인과 분석 표현 수: {signals.cause_analysis_count}개\n"
            f"- 대안 언급 수: {signals.alternative_count}개\n"
            f"- 구체성 점수: {signals.specificity_score:.2f}/1.0"
        )
    else:  # executive
        return (
            f"[경영진 관심 신호]\n"
            f"- 비즈니스 임팩트 키워드 밀도: {_keyword_score(answer, BUSINESS_KEYWORDS):.2f}/1.0\n"
            f"- 성과 점수: {signals.achievement_score:.2f}/1.0\n"
            f"- 구체성 점수: {signals.specificity_score:.2f}/1.0\n"
            f"- 주도성 동사 수: {signals.agency_verb_count}개"
        )
```

**AC**:
- [ ] HR/Tech/Exec 동일 답변 → 서로 다른 텍스트 반환
- [ ] 결정론적, LLM 의존 없음

---

### Step 3: 페르소나별 꼬리질문 프롬프트 3개 생성

**파일**: `engine/app/prompts/persona_hr_v1.md`, `persona_tech_v1.md`, `persona_exec_v1.md`

**공통 구조**:
1. 역할 정의 (페르소나 관점, 담당 8축)
2. 답변 신호 컨텍스트: `{persona_signals}` 플레이스홀더
3. 압박도 지침: `{pressure_type}` 값에 따른 질문 강도
   - `CLARIFY`: 답변이 모호함 / 구조 불완전 → 구체적 경험/사례 요청
   - `CHALLENGE`: 답변 깊이 부족 → 근거/논리 추궁
   - `EXPLORE`: 답변 충분 → 관련 심화 주제 확장
4. 꼬리질문 생성 지침 (페르소나별 차별화)
5. 금지 사항 + 자기 검증
6. 입력 변수: `{question}`, `{answer}`, `{persona_signals}`, `{pressure_type}`, `{resume_text}`
7. 출력 형식: `{"shouldFollowUp": bool, "followupType": str, "followupQuestion": str, "reasoning": str}`

**페르소나별 차별화**:
- **HR**: 동기/감정/협업 경험 탐색, STAR 행동 구체화, 담당 축: communication·cultureFit·sincerity
- **Tech Lead**: 기술적 근거/대안/트레이드오프 추궁, 담당 축: jobExpertise·problemSolving·logicalThinking
- **Executive**: 비즈니스 임팩트/수치/확장성, "So what?" 관점, 담당 축: leadership·creativity·problemSolving

**AC**:
- [ ] 3개 파일 모두 `{persona_signals}`, `{pressure_type}`, `{question}`, `{answer}`, `{resume_text}` 포함
- [ ] 역할 정의가 명확히 다름
- [ ] 출력 JSON 구조가 기존 `interview_followup_v2.md`와 동일

---

### Step 4: `interview_service.py` 수정

**4-1. 신규 import 추가**:
```python
from app.analyzers.pressure_controller import classify_pressure
from app.analyzers.answer_signals import format_persona_signals
```

**4-2. PERSONA_FOLLOWUP_PROMPTS dict 추가** (기존 PERSONA_PROMPTS 아래):
```python
PERSONA_FOLLOWUP_PROMPTS = {
    "hr": "persona_hr_v1.md",
    "tech_lead": "persona_tech_v1.md",
    "executive": "persona_exec_v1.md",
}
```

**4-3. `_check_followup()` 수정**:
```python
def _check_followup(question, answer, persona, resumeText, *, model=None):
    # 1. 신호 추출
    signals = analyze(answer)
    # 2. 압박도 분류 (결정론적)
    pressure_type = classify_pressure(signals)
    # 3. 페르소나별 관심 신호 포맷
    persona_signals_text = format_persona_signals(answer, signals, persona)
    # 4. 페르소나별 프롬프트 로드 (fallback: interview_followup_v2.md)
    followup_prompt_name = PERSONA_FOLLOWUP_PROMPTS.get(persona, "interview_followup_v2.md")
    prompt_file = PROMPT_DIR / followup_prompt_name
    prompt_template = prompt_file.read_text(encoding="utf-8")
    # 5. 플레이스홀더 치환
    prompt = (
        prompt_template
        .replace("{question}", question)
        .replace("{answer}", answer)
        .replace("{persona_signals}", persona_signals_text)
        .replace("{pressure_type}", pressure_type)
        .replace("{resume_text}", resumeText[:16000])
    )
    # 6. LLM 호출 (기존과 동일)
    result = _call_llm(prompt, model=model,
                       error_message="면접 진행 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.")
    return _parse_object(result.content, required_keys=["shouldFollowUp"]), result.usage, result.model
```

**4-4. `_classify_followup_type()` — pressure_controller에 위임**:
```python
def _classify_followup_type(answer: str) -> FollowupType:
    """규칙 기반 followup 유형 분류. pressure_controller.classify_pressure()에 위임."""
    signals = analyze(answer)
    return classify_pressure(signals)
```

**4-5. `generate_followup()` / `process_answer()` — 코드 변경 없음**
- `generate_followup()`은 `_classify_followup_type()` + `_check_followup()` 호출 (내부 로직 변경으로 자동 적용)
- `process_answer()`은 `_check_followup()` 호출 (내부 로직 변경으로 자동 적용)
- 두 함수의 공개 API 시그니처 유지

**AC**:
- [ ] `_check_followup(..., "hr", ...)` → `persona_hr_v1.md` 로드
- [ ] `_check_followup(..., "tech_lead", ...)` → `persona_tech_v1.md` 로드
- [ ] `_check_followup(..., "executive", ...)` → `persona_exec_v1.md` 로드
- [ ] 미등록 페르소나 → `interview_followup_v2.md` fallback
- [ ] `{persona_signals}`와 `{pressure_type}`이 프롬프트에 주입됨
- [ ] 기존 테스트 전부 통과

---

### Step 5: 테스트 작성

**`test_pressure_controller.py`** (~8개):
```
1. calc_answer_quality 정확성: star=0.4, spec=0.5, ach=0.3 → 41.0
2. calc_answer_quality 만점/0점 경계
3. classify_pressure CHALLENGE: quality < 60, vague OK, agency > 0
4. classify_pressure CLARIFY (vague): vague > 0.04
5. classify_pressure CLARIFY (agency): agency_verb == 0
6. classify_pressure EXPLORE: 모두 OK
7. 우선순위: vague > 0.04 AND agency == 0 → CLARIFY (vague 우선)
8. 경계값: quality=60.0 정확히 → NOT CHALLENGE
```

**`test_answer_signals.py`** (~6개):
```
1~3. HR/Tech/Exec 각 관심 키워드 포함 답변 → 해당 신호 텍스트 포함 확인
4. 동일 답변 + 다른 페르소나 → 다른 텍스트
5. 빈 텍스트 → 에러 없이 동작
6. 결정론적 확인
```

**`test_interview_service.py` 추가** (~6개):
```
1~3. _check_followup HR/Tech/Exec → 각 persona_*.md 파일 로드 확인 (mock Path.read_text)
4. 미등록 페르소나 → interview_followup_v2.md fallback
5. _classify_followup_type가 새 규칙 적용 확인 (vague 높은 답변 → CLARIFY)
6. AC #2 검증: 동일 답변 + 다른 페르소나 → LLM에 다른 프롬프트 텍스트 전달 (mock _call_llm)
```

**AC**:
- [ ] 전체 새 테스트 ~20개 이상
- [ ] 신규 모듈 커버리지 90%+
- [ ] 기존 테스트 전부 통과

---

## 변경 파일 목록

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `engine/app/analyzers/pressure_controller.py` | 신규 | answer_quality 공식 + 규칙 기반 압박도 분류 |
| `engine/app/analyzers/answer_signals.py` | 신규 | 페르소나별 관심 영역 신호 포맷팅 |
| `engine/app/analyzers/__init__.py` | 수정 | 새 모듈 export |
| `engine/app/prompts/persona_hr_v1.md` | 신규 | HR 꼬리질문 전용 프롬프트 |
| `engine/app/prompts/persona_tech_v1.md` | 신규 | Tech Lead 꼬리질문 전용 프롬프트 |
| `engine/app/prompts/persona_exec_v1.md` | 신규 | Executive 꼬리질문 전용 프롬프트 |
| `engine/app/services/interview_service.py` | 수정 | _check_followup 신호/압박도 주입, _classify_followup_type 위임 |
| `engine/app/prompts/.ai.md` | 수정 | 새 프롬프트 파일 기재 |
| `engine/app/analyzers/.ai.md` | 수정 | 새 모듈 기재 |
| `engine/tests/unit/analyzers/test_pressure_controller.py` | 신규 | pressure_controller 단위 테스트 |
| `engine/tests/unit/analyzers/test_answer_signals.py` | 신규 | answer_signals 단위 테스트 |
| `engine/tests/unit/services/test_interview_service.py` | 수정 | 통합 관련 추가 테스트 |

---

## ADR

**Decision**: 페르소나별 독립 꼬리질문 프롬프트 3개 + `_check_followup()` 내부 신호/압박도 주입

**Why**: AC #1 "각각 독립 프롬프트 파일" 직접 충족. vague_ratio 임계값을 실측 범위 기반으로 조정하여 실효성 확보. `_check_followup()` 내 통합으로 `process_answer()`와 `generate_followup()` 모두에 일관 적용.

**Consequences**:
- 프롬프트 3개 유지보수 부담 (공통 변경 시 3곳 수정)
- 기존 `interview_followup_v2.md`는 fallback 보존
- 기존 `_classify_followup_type()`의 세분화 조건을 `classify_pressure()`에 통합

**Open Questions**:
- [ ] answer_quality 가중합 공식은 초안 — 합격 자소서 데이터로 추후 튜닝
- [ ] VAGUE_RATIO_PRESSURE_THRESHOLD=0.04는 corpus p90 추정 — 실제 면접 답변 데이터로 검증 필요
