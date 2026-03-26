# [#73] feat: [고도화] LLM 테스트 에이전트 — E2E 자동 면접 시뮬레이션 및 점수 향상 지표 측정 — 구현 계획

> 작성: 2026-03-25

---

## 완료 기준

- [ ] 테스트 에이전트가 샘플 PDF를 업로드하고 질문 목록을 수신한다
- [ ] 테스트 에이전트가 LLM을 사용해 각 질문에 대한 답변을 자동 생성한다 (페르소나: 지원자 역할)
- [ ] 꼬리질문(followup) 흐름까지 포함한 완전한 면접 세션을 자동 완주한다
- [ ] 세션 종료 후 `POST /api/report/generate`를 호출하여 8축 점수를 수집한다
- [ ] 복수 실행 결과를 JSON으로 저장하고 점수 평균·표준편차를 리포트한다
- [ ] 프롬프트 버전 A/B 비교 실행을 지원한다 (동일 PDF, 다른 프롬프트)
- [ ] CI에서 선택적으로 실행 가능하도록 환경변수 플래그(`RUN_E2E_AGENT=true`)로 제어한다

---

## 구현 계획

### 배경 및 설계 결정

**E2E 접근 방식**: TestClient(mocked LLM)가 아닌 **실제 서버에 httpx HTTP 요청**.
- 이유: 실제 LLM 응답 품질·프롬프트 효과를 측정하는 것이 목적
- 선행 조건: 엔진 서버가 `ENGINE_BASE_URL`에 구동 중이어야 함 (기본값 `http://localhost:8000`)

**불변식 준수**:
- 테스트 에이전트는 "외부 HTTP 클라이언트" — 엔진 내부 코드에 직접 접근하지 않음
- 지원자 역할 LLM 호출(답변 생성)은 `tests/e2e/agent.py` 내부에서만 — 서비스 레이어가 아닌 테스트 유틸리티이므로 불변식 위반 아님
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
├── runner.py                 # SessionRunner: 전체 면접 흐름 HTTP 클라이언트
├── reporter.py               # 결과 JSON 저장 + 통계 계산
├── test_agent_unit.py        # agent/reporter 단위 테스트 (mocked LLM, CI 포함)
├── test_agent_session.py     # E2E 통합 테스트 (RUN_E2E_AGENT=true 필요)
├── prompts/
│   ├── candidate_v1.md       # 지원자 페르소나 프롬프트 (기본)
│   └── candidate_v2.md       # A/B 비교용 프롬프트 변형
└── results/
    └── .gitkeep              # 결과 JSON 저장 디렉토리 (gitignored)
```

---

### Step 1 — 디렉토리·기반 파일

**생성 파일**: `__init__.py`, `results/.gitkeep`, `prompts/candidate_v1.md`, `prompts/candidate_v2.md`

**candidate_v1.md** (기본 페르소나):
```
당신은 면접을 준비하는 지원자입니다.
아래 자소서 내용을 바탕으로 면접관 질문에 자연스럽고 구체적인 답변을 생성하세요.
STAR(상황-과제-행동-결과) 구조를 사용하되, 지나치게 형식적이지 않게 작성하세요.
답변은 200자 이상 400자 이하로 작성하세요.
```

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
- `generate_answer(question, resume_text, history) -> str`
- 프롬프트 경로를 `variant` 파라미터로 교환 가능 (A/B 지원)

```python
class CandidateAgent:
    def __init__(self, llm_fn=None, prompt_variant: str = "v1"):
        # llm_fn=None이면 실제 OpenRouter 호출
        # llm_fn이 주입되면 해당 함수 사용 (단위 테스트용)
        ...

    def generate_answer(self, question: str, resume_text: str, history: list[dict]) -> str:
        ...
```

**주의**: `agent.py`는 `app.*` 임포트 금지.
`engine/app/services/llm_client.py`의 `call_llm`을 가져다 쓰면 `pythonpath=["."]` 덕분에 작동은 되지만,
테스트 코드가 엔진 내부 서비스에 의존하게 되어 불변식 취지가 흐려진다.
`agent.py` 내에서 `openai.OpenAI`를 직접 생성해 사용한다.

---

### Step 3 — `runner.py`: SessionRunner

**역할**: 단일 면접 세션의 전체 HTTP 흐름을 자동 실행

**흐름**:
```
1. POST /api/resume/parse        (multipart PDF)         → resumeText
2. POST /api/interview/start     (resumeText, personas)  → firstQuestion, questionsQueue
3. current_q  = firstQuestion.question
   current_p  = firstQuestion.persona
   current_pl = firstQuestion.personaLabel
   queue      = questionsQueue
   history    = []
   loop:
     answer = agent.generate_answer(current_q, resumeText, history)
     answer = answer[:5000]   ← InterviewAnswerRequest.currentAnswer max_length=5000
     resp = POST /api/interview/answer({
         resumeText,
         history,
         questionsQueue = queue,
         currentQuestion = current_q,   ← 스키마 필수 필드
         currentPersona  = current_p,   ← 스키마 필수 필드
         currentAnswer   = answer,
     })
     history.append(HistoryItem(
         persona=current_p, personaLabel=current_pl,
         question=current_q, answer=answer,
     ))  ← 엔진은 업데이트된 history를 반환하지 않으므로 runner가 직접 누적
     if resp.sessionComplete: break
     current_q  = resp.nextQuestion.question
     current_p  = resp.nextQuestion.persona
     current_pl = resp.nextQuestion.personaLabel
     queue      = resp.updatedQueue
4. if len(history) < 5: raise RuntimeError (MIN_ANSWERS 미달 — report 호출 불가)
5. POST /api/report/generate     (resumeText, history)   → scores (8축)
```

> **주의**: `/api/resume/questions`는 인터뷰 흐름과 무관 — 호출하지 않는다.
> `/interview/start`가 첫 질문과 큐를 직접 생성한다.

**반환 타입** `SessionResult` (dataclass):
```python
@dataclass
class SessionResult:
    run_id: str           # uuid4
    timestamp: str        # ISO8601
    variant: str          # "v1" or "v2"
    scores: dict          # 8축 점수 dict
    total_score: int
    turn_count: int
    history: list[dict]   # 전체 Q&A 이력
    duration_sec: float
```

---

### Step 4 — `reporter.py`: ResultReporter

**역할**: `SessionResult` 저장 + 통계 계산

```python
def save_result(result: SessionResult, results_dir: Path) -> Path:
    # results/{timestamp}_{variant}.json 저장
    ...

def compute_stats(results: list[SessionResult]) -> dict:
    # 8축별 mean, std 계산
    # delta: 첫 실행 대비 마지막 실행 차이
    ...

def print_report(stats: dict) -> None:
    # 콘솔 출력: 축별 평균/표준편차/delta 테이블
    ...
```

**통계 계산**: `statistics.mean`, `statistics.stdev` (표준 라이브러리, 외부 의존성 없음)

> **주의**: `statistics.stdev`는 데이터 2개 미만이면 `StatisticsError` 발생.
> `stdev = statistics.stdev(values) if len(values) >= 2 else 0.0` 으로 가드 필수.

---

### Step 5 — `conftest.py` (e2e 전용)

```python
import os, pytest

# RUN_E2E_AGENT 플래그 없으면 모든 e2e 테스트 자동 skip
def pytest_collection_modifyitems(items):
    if not os.getenv("RUN_E2E_AGENT"):
        for item in items:
            if "e2e" in str(item.fspath):
                item.add_marker(pytest.mark.skip(reason="RUN_E2E_AGENT not set"))

@pytest.fixture
def base_url() -> str:
    return os.getenv("ENGINE_BASE_URL", "http://localhost:8000")

@pytest.fixture
def sample_pdf_bytes(minimal_pdf_bytes) -> bytes:
    # 실제 fixtures/input/sample_resume.pdf 있으면 사용, 없으면 합성 PDF
    ...
```

---

### Step 6 — `test_agent_unit.py` (CI 포함 단위 테스트)

**테스트 항목** (mock LLM, 실제 서버 불필요):

| 테스트 | 내용 |
|--------|------|
| `test_candidate_agent_generates_answer` | mock LLM 주입 → `generate_answer` 반환값 검증 |
| `test_candidate_agent_uses_variant_prompt` | v1/v2 프롬프트 경로 전환 검증 |
| `test_compute_stats_single` | 결과 1개 → mean=score, std=0 |
| `test_compute_stats_multiple` | 결과 3개 → mean/std 정확도 검증 |
| `test_compute_stats_delta` | 첫 번째 vs 마지막 delta 계산 검증 |
| `test_save_result_creates_file` | `tmp_path` 이용, JSON 파일 생성·내용 검증 |

---

### Step 7 — `test_agent_session.py` (E2E, `RUN_E2E_AGENT=true` 필요)

**테스트 항목**:

| 테스트 | 내용 |
|--------|------|
| `test_single_session_completes` | 단일 세션 완주, scores 8개 키 존재 검증 |
| `test_session_includes_followup` | history에 followup 턴 포함 여부 검증 |
| `test_ab_comparison` | v1/v2 각 1회 실행 → 결과 저장·delta 리포트 출력 |
| `test_multiple_runs_stats` | 동일 variant 3회 → mean/std 계산 검증 |

---

### Step 8 — `.ai.md` 작성

`engine/tests/e2e/.ai.md`: 디렉토리 목적·실행 방법·주의사항 기술

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
| `engine/.gitignore` | `tests/e2e/results/` 추가 — 결과 JSON에 이력서 텍스트 포함 가능, 커밋 금지 |

---

### 엣지 케이스·주의사항

1. **세션 무한루프 방지**: `runner.py`에 `MAX_TURNS = 15` 하드 리밋 → 초과 시 강제 종료 후 경고 로그
2. **서버 미구동 시**: `httpx.ConnectError` → 명확한 오류 메시지로 래핑 ("ENGINE_BASE_URL에 서버가 구동 중인지 확인하세요")
3. **API 비용**: 단일 세션 약 10~15턴 × 2 LLM 호출(엔진 + 에이전트) → `test_multiple_runs_stats`는 3회로 제한
4. **results/ gitignore**: 실행 결과 JSON에 이력서 텍스트 포함 가능 → 커밋 금지 필수
5. **report 최소 5턴 요건**: `InsufficientAnswersError` (422) 방어 — runner가 최소 5턴 보장 후 report 호출
6. **personas 고정값**: `["hr", "tech_lead", "executive"]` panel 모드 사용 (start 엔드포인트 계약)
