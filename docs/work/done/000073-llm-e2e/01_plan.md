# [#73] feat: [고도화] LLM 테스트 에이전트 — E2E 자동 면접 시뮬레이션 및 점수 향상 지표 측정 — 구현 계획

> 작성: 2026-03-25

---

## 완료 기준

- [x] 테스트 에이전트가 샘플 PDF를 업로드하고 질문 목록을 수신한다
- [x] 테스트 에이전트가 LLM을 사용해 각 질문에 대한 답변을 자동 생성한다 (페르소나: 지원자 역할)
- [x] 꼬리질문(followup) 흐름까지 포함한 완전한 면접 세션을 자동 완주한다
- [x] 세션 종료 후 `POST /api/report/generate`를 호출하여 8축 점수와 axisFeedbacks를 수집한다
- [x] 복수 실행 결과를 JSON으로 저장하고 점수 평균·표준편차를 리포트한다
- [x] 프롬프트 버전 A/B 비교 실행을 지원한다 (동일 PDF, 다른 프롬프트)
- [x] CI에서 선택적으로 실행 가능하도록 환경변수 플래그(`RUN_E2E_AGENT=true`)로 제어한다
- [x] **피드백 루프**: 세션1 axisFeedbacks를 AI에게 주입 → 세션2 답변 생성 → 피드백이 LLM 컨텍스트에 포함됐는지 검증 (`prompt_log`) + 점수 delta 측정

---

## 구현 계획

### 배경 및 설계 결정

**핵심 목적**: 피드백 루프 검증.
세션1에서 면접을 완주하고 받은 `axisFeedbacks`를 AI가 읽은 뒤, 세션2에서 개선된 답변을 내놓는지 — 그리고 피드백이 실제로 LLM 컨텍스트에 포함됐는지 — 검증한다.

```
세션1 → 8축 점수 + axisFeedbacks
→ format_feedback() → 프롬프트 텍스트
→ CandidateAgent(prior_feedback=...) → 세션2
→ prompt_log assert + 점수 delta 측정
```

**E2E 접근 방식**: TestClient(mocked LLM)가 아닌 **실제 서버에 httpx HTTP 요청**.
- 이유: 실제 LLM 응답 품질·피드백 반영 효과를 측정하는 것이 목적
- 선행 조건: 엔진 서버가 `ENGINE_BASE_URL`에 구동 중이어야 함 (기본값 `http://localhost:8000`)

**불변식 준수**:
- 테스트 에이전트는 "외부 HTTP 클라이언트" — 엔진 내부 코드에 직접 접근하지 않음
- 지원자 역할 LLM 호출(답변 생성)은 `tests/e2e/agent.py` 내부에서만
- 엔진의 모든 인터뷰/리포트 LLM 호출은 여전히 `engine/app/services/` 에서만

**비용 제어**: `RUN_E2E_AGENT=true` 환경변수 없이는 자동 skip — CI 기본 실행에서 제외

---

### 신규 파일 구조

```
engine/tests/e2e/
├── __init__.py
├── .ai.md                    # 이 디렉토리 목적·규칙
├── conftest.py               # e2e 전용 픽스처·마크 설정
├── agent.py                  # CandidateAgent: 지원자 역할 LLM 답변 생성기
├── runner.py                 # run_session() + format_feedback()
├── reporter.py               # 결과 JSON 저장 + 통계 계산
├── test_agent_unit.py        # agent/reporter 단위 테스트 (mocked LLM, CI 포함)
├── test_agent_session.py     # E2E 통합 테스트 (RUN_E2E_AGENT=true 필요)
├── prompts/
│   ├── candidate_v1.md       # 신입 지원자 페르소나 (~70-80점), {prior_feedback} 포함
│   └── candidate_v2.md       # A/B 비교용 프롬프트 변형
└── results/
    └── .gitkeep              # 결과 JSON 저장 디렉토리 (gitignored)
```

---

### Step 1 — 디렉토리·기반 파일

**생성 파일**: `__init__.py`, `results/.gitkeep`, `prompts/candidate_v1.md`, `prompts/candidate_v2.md`

**candidate_v1.md** (기본 페르소나 — 신입 수준, 피드백 주입 가능):
```
당신은 면접 경험이 많지 않은 신입 지원자입니다.
답변은 150자 이상 250자 이하로 작성한다.

[이전 면접 피드백]
{prior_feedback}

[면접관 질문]
{question}
```

피드백 루프 효과를 측정하려면 초기 점수에 개선 여지가 있어야 한다.
v1 페르소나를 ~70-80점 수준으로 설계해 피드백 반영 후 점수 향상이 가시적으로 드러나게 한다.

**candidate_v2.md** (A/B 비교용 — 더 간결한 페르소나):
```
당신은 신입 지원자로서 면접 질문에 솔직하고 간결하게 답변합니다.
구체적인 경험과 수치를 포함해 80자 이상 200자 이하로 답변하세요.
```

---

### Step 2 — `agent.py`: CandidateAgent

**역할**: 질문을 받아 LLM으로 지원자 답변을 생성하는 경량 클래스

**설계 원칙**:
- LLM 의존성을 생성자 주입 가능하게 설계 → 단위 테스트 시 mock 주입
- `prior_feedback`: 이전 세션 피드백을 프롬프트에 주입 (피드백 루프 핵심)
- `prompt_log`: 실제 LLM에 전달된 프롬프트를 누적 기록 → 피드백 주입 여부를 테스트에서 assert

```python
class CandidateAgent:
    def __init__(
        self,
        llm_fn=None,
        prompt_variant: str = "v1",
        prior_feedback: str = "",
    ):
        self._llm_fn = llm_fn
        self.prompt_variant = prompt_variant
        self.prior_feedback = prior_feedback
        self._prompt_template: str | None = None
        self.prompt_log: list[str] = []

    def generate_answer(self, question: str, resume_text: str, history: list[dict]) -> str:
        prompt = template.replace("{prior_feedback}", self.prior_feedback) ...
        self.prompt_log.append(prompt)  # 검증용 기록
        ...
        return answer[:5000]
```

**주의**: `agent.py`는 `app.*` 임포트 금지.
`agent.py` 내에서 `openai.OpenAI`를 직접 생성해 사용한다.
`OPENROUTER_API_KEY` 미설정 시 빈 문자열 대신 `RuntimeError`로 fail-fast한다.

---

### Step 3 — `runner.py`: run_session() + format_feedback()

**역할**: 단일 면접 세션의 전체 HTTP 흐름을 자동 실행

**`format_feedback()`**: `axisFeedbacks` 목록을 프롬프트용 텍스트로 변환

```python
def format_feedback(feedback: list[dict]) -> str:
    lines = []
    for item in feedback:
        label = item.get("axisLabel", item.get("axis", ""))
        score_str = f"{item['score']}점" if item.get("score") is not None else "미평가"
        lines.append(f"- {label} ({score_str}, {item['type']}): {item['feedback']}")
    return "\n".join(lines)
```

**흐름**:
```
1. POST /api/resume/parse        (multipart PDF)         → resumeText
2. POST /api/interview/start     (resumeText, personas)  → firstQuestion, questionsQueue
3. 답변 루프:
     answer = agent.generate_answer(current_q, resumeText, history)
     answer = answer[:5000]   ← InterviewAnswerRequest.currentAnswer max_length=5000
     resp = POST /api/interview/answer({
         resumeText, history,
         questionsQueue, currentQuestion, currentPersona,  ← 스키마 필수 필드
         currentAnswer,
     })
     history.append(...)  ← 엔진은 업데이트된 history를 반환하지 않으므로 runner가 직접 누적
     if resp.sessionComplete: break
4. if len(history) < 5: raise SessionRunError (MIN_ANSWERS 미달)
5. POST /api/report/generate     (resumeText, history)   → scores + axisFeedbacks + summary
```

> **주의**: `/api/resume/questions`는 인터뷰 흐름과 무관 — 호출하지 않는다.

**반환 타입** `SessionResult` (dataclass):
```python
@dataclass
class SessionResult:
    run_id: str
    timestamp: str
    variant: str
    scores: dict[str, int | None]   # 8축 flat dict
    total_score: int
    turn_count: int
    history: list[dict]
    duration_sec: float
    feedback: list[dict]            # axisFeedbacks — 피드백 루프에 사용
    summary: str                    # 리포트 총평
```

---

### Step 4 — `reporter.py`: ResultReporter

**역할**: `SessionResult` 저장 + 통계 계산

```python
def save_result(result: SessionResult, results_dir: Path) -> Path:
    # results/{timestamp}_{variant}.json 저장 (feedback/summary 포함)

def compute_stats(results: list[SessionResult]) -> dict:
    # 8축별 mean, std 계산
    # delta: 첫 실행 대비 마지막 실행 차이 (단일 결과 시 None)

def print_report(stats: dict) -> None:
    # 콘솔 출력: 축별 평균/표준편차/delta 테이블
```

> **주의**: `statistics.stdev`는 데이터 2개 미만이면 `StatisticsError` 발생.
> `stdev = statistics.stdev(values) if len(values) >= 2 else 0.0` 으로 가드 필수.
> delta도 단일 결과 시 `0` 대신 `None` 반환 — 의미 없는 값 방지.

---

### Step 5 — `conftest.py` (e2e 전용)

```python
# .env 수동 로드 (pytest 프로세스는 .env 자동 로드 안 함)
# 따옴표 포함 값(KEY="value") 처리: .strip().strip('"').strip("'")
os.environ.setdefault(_key.strip(), _val.strip().strip('"').strip("'"))

# RUN_E2E_AGENT 없으면 test_agent_session.py 자동 skip
# test_agent_unit.py는 항상 실행 (mock LLM, 비용 없음)

# import fitz: 픽스처 내부 lazy import (단위 테스트 경로에서 PyMuPDF 불필요)
```

---

### Step 6 — `test_agent_unit.py` (CI 포함 단위 테스트, 27개)

| 클래스 | 수 | 내용 |
|--------|-----|------|
| `TestCandidateAgent` | 11개 | mock llm_fn, prior_feedback 주입, prompt_log 기록, 5000자 절단, history 포맷팅 |
| `TestFormatFeedback` | 3개 | axisFeedbacks 텍스트 변환, 빈 목록, None 점수 처리 |
| `TestComputeStats` | 9개 | 빈 결과, 단일(delta=None, stdev 가드), 복수 mean/std/delta |
| `TestSaveResult` | 4개 | 파일명 형식, JSON 직렬화(feedback/summary 포함), dir 자동 생성 |

---

### Step 7 — `test_agent_session.py` (E2E, `RUN_E2E_AGENT=true` 필요, 8개)

| 클래스 | 테스트 | 내용 |
|--------|--------|------|
| `TestSingleSession` | 3개 | 단일 세션 완주, history Q&A 검증, 점수 0~100 범위 검증 |
| `TestFollowupIncluded` | 1개 | followup 포함 세션 완주 (발생 여부는 LLM 판단 — assert 안 함) |
| **`TestFeedbackLoop`** | **1개** | **세션1 → axisFeedbacks → 세션2 → prompt_log assert + delta 출력** |
| `TestABComparison` | 1개 | v1/v2 각 1회 실행 → compute_stats로 delta 비교 |
| `TestMultipleRunsStats` | 1개 | 동일 variant 3회 → mean/std 계산 |

`TestFeedbackLoop`가 이 이슈의 핵심 시나리오다.

---

### Step 8 — `.ai.md` 작성

`engine/tests/e2e/.ai.md`: 디렉토리 목적·실행 방법·불변식·환경변수 기술

---

### 변경 파일 요약

| 파일 | 작업 |
|------|------|
| `engine/tests/e2e/__init__.py` | 신규 |
| `engine/tests/e2e/.ai.md` | 신규 |
| `engine/tests/e2e/conftest.py` | 신규 |
| `engine/tests/e2e/agent.py` | 신규 |
| `engine/tests/e2e/runner.py` | 신규 |
| `engine/tests/e2e/reporter.py` | 신규 |
| `engine/tests/e2e/test_agent_unit.py` | 신규 |
| `engine/tests/e2e/test_agent_session.py` | 신규 |
| `engine/tests/e2e/prompts/candidate_v1.md` | 신규 |
| `engine/tests/e2e/prompts/candidate_v2.md` | 신규 |
| `engine/tests/e2e/results/.gitkeep` | 신규 |
| `engine/tests/.ai.md` | 업데이트 (e2e 디렉토리 추가) |
| `engine/.gitignore` | `tests/e2e/results/` 추가 |

---

### 엣지 케이스·주의사항

1. **세션 무한루프 방지**: `runner.py`에 `MAX_TURNS = 15` 하드 리밋 → 초과 시 강제 종료 후 경고 로그
2. **서버 미구동 시**: `httpx.ConnectError` → 명확한 오류 메시지로 래핑
3. **API 비용**: 단일 세션 약 10~15턴 × 2 LLM 호출(엔진 + 에이전트) → `test_multiple_runs_stats`는 3회로 제한
4. **results/ gitignore**: 실행 결과 JSON에 이력서 텍스트 포함 가능 → 커밋 금지 필수
5. **report 최소 5턴 요건**: `InsufficientAnswersError` (422) 방어 — runner가 최소 5턴 보장 후 report 호출
6. **personas 고정값**: `["hr", "tech_lead", "executive"]` panel 모드 사용
7. **피드백 루프 delta**: LLM 비결정성으로 점수 향상이 보장되지 않음 — `prompt_log` assert로 피드백 주입 여부를 직접 검증
