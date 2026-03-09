# [#40] feat: [engine] 기능 03+04 — 패널 면접 세션 + 꼬리질문 엔진 구현 — 구현 계획

> 작성: 2026-03-09

---

## 완료 기준

- [x] `POST /api/interview/start` — resumeText + personas 받아 첫 질문(HR) + questionsQueue(9개) 반환
- [x] `POST /api/interview/answer` — history + questionsQueue + currentAnswer 받아 꼬리질문(자동 판단) 또는 다음 본 질문 반환
- [x] `POST /api/interview/followup` — question + answer + persona 받아 CLARIFY·CHALLENGE·EXPLORE 꼬리질문 반환
- [x] 페르소나 3종 system prompt `.md` 파일 (HR·기술팀장·경영진)
- [x] 꼬리질문 유형 판단 + 생성 프롬프트 `.md` 파일
- [x] 10턴 면접 (`MAX_TURNS=10`) + 꼬리질문 자동 판단 내장
- [x] 동일 페르소나 꼬리질문 최대 2회 제한 (`MAX_FOLLOWUPS=2`)
- [x] TDD: 모든 구현은 pytest Red → Green → Refactor 사이클로 작성 (62 passed)
- [x] `engine/.ai.md` 최신화
- [x] 불변식 준수: LLM 호출은 `engine/services/`에서만, `session_store.py` 없음

---

## 최종 파일 목록

| 파일 | 상태 | 설명 |
|------|------|------|
| `engine/app/schemas.py` | **수정** | `Field` import, Interview 스키마 7종, `InterviewAnswerRequest`에 `currentQuestion`·`currentPersona` 추가 |
| `engine/app/services/interview_service.py` | **신규** | 서비스 함수 3개 + 내부 헬퍼 5개 |
| `engine/app/prompts/interview_hr_v1.md` | **신규** | HR 담당자 — 조직 적합성·협업·인성 |
| `engine/app/prompts/interview_tech_lead_v1.md` | **신규** | 기술팀장 — 직무 역량·문제해결·기술 깊이 |
| `engine/app/prompts/interview_executive_v1.md` | **신규** | 경영진 — 성장 가능성·비전·비즈니스 임팩트 |
| `engine/app/prompts/interview_followup_v1.md` | **신규** | 꼬리질문 CLARIFY/CHALLENGE/EXPLORE 판단 + 생성 |
| `engine/app/routers/interview.py` | **신규** | 3개 엔드포인트 (start·answer·followup) |
| `engine/app/main.py` | **수정** | interview router 등록, validation 오류 메시지 일반화 |
| `engine/tests/unit/services/test_interview_service.py` | **신규** | 17개 테스트 |
| `engine/tests/integration/test_interview_router.py` | **신규** | 11개 테스트 |
| `engine/.ai.md` | **수정** | 신규 엔드포인트 3개 계약 추가 |

---

## 최종 스키마

```python
PersonaType = Literal["hr", "tech_lead", "executive"]
FollowupType = Literal["CLARIFY", "CHALLENGE", "EXPLORE"]

class QueueItem(BaseModel):
    persona: PersonaType
    type: Literal["main", "follow_up"]

class QuestionWithPersona(BaseModel):
    persona: PersonaType
    personaLabel: str
    question: str
    type: Literal["main", "follow_up"] = "main"

class HistoryItem(BaseModel):
    persona: PersonaType
    personaLabel: str
    question: str
    answer: str

class InterviewStartRequest(BaseModel):
    resumeText: str = Field(..., min_length=1)
    personas: list[PersonaType] = Field(..., min_length=1)
    mode: Literal["panel"] = "panel"

class InterviewStartResponse(BaseModel):
    firstQuestion: QuestionWithPersona
    questionsQueue: list[QueueItem]  # 9개 (MAX_TURNS-1)

class InterviewAnswerRequest(BaseModel):
    resumeText: str = Field(..., min_length=1)
    history: list[HistoryItem]
    questionsQueue: list[QueueItem]
    currentQuestion: str = Field(..., min_length=1)   # 현재 답변 중인 질문
    currentPersona: PersonaType                        # 현재 질문의 페르소나
    currentAnswer: str = Field(..., min_length=1, max_length=5000)

class InterviewAnswerResponse(BaseModel):
    nextQuestion: QuestionWithPersona | None = None   # sessionComplete=True 시 None
    updatedQueue: list[QueueItem]
    sessionComplete: bool

class FollowupRequest(BaseModel):
    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)
    persona: PersonaType
    resumeText: str = Field(..., min_length=1)

class FollowupResponse(BaseModel):
    followupType: FollowupType
    followupQuestion: str
    reasoning: str
```

---

## 서비스 로직 (최종)

### 상수
```python
MAX_TURNS = 10       # 총 면접 턴 수
MAX_FOLLOWUPS = 2    # 동일 페르소나 꼬리질문 최대 횟수
```

### `start_interview(resumeText, personas)`
1. `personas[0]` 프롬프트 로드 → LLM 1회 → `firstQuestion` 생성
2. `_build_queue(personas, MAX_TURNS)` → round-robin으로 9개 큐 생성
   - 예: `["hr","tech_lead","executive"]` → `[tech_lead, executive, hr, tech_lead, executive, hr, tech_lead, executive, hr]`

### `process_answer(resumeText, history, questionsQueue, currentQuestion, currentPersona, currentAnswer)`

```
1. len(history)+1 >= MAX_TURNS  OR  큐 비어있음
   → LLM 없이 sessionComplete=True 즉시 반환

2. _count_trailing_persona(history, currentPersona) < MAX_FOLLOWUPS
   → _check_followup() LLM 1회 호출
   → shouldFollowUp=True: 꼬리질문 반환, 큐 변경 없음
   → shouldFollowUp=False 또는 MAX_FOLLOWUPS 초과: 다음 단계

3. 큐[0] 페르소나로 다음 질문 생성 LLM 1회
   → nextQuestion 반환, updatedQueue = 큐[1:]
```

**LLM 호출 횟수:**
| 케이스 | LLM 호출 |
|--------|---------|
| 꼬리질문 발동 | 1회 (followup check 결과 재사용) |
| 꼬리질문 스킵 → 다음 질문 | 2회 (followup check + next question) |
| MAX_FOLLOWUPS 초과 → 다음 질문 | 1회 (next question만) |
| 빈 큐 / MAX_TURNS 초과 | 0회 |

### `generate_followup(question, answer, persona, resumeText)`
- `_check_followup()` 재사용 → `FollowupResponse` 반환

---

## 예외 처리 현황

| 케이스 | 처리 | HTTP |
|--------|------|------|
| 필수 필드 누락 | Pydantic ValidationError | 400 |
| `resumeText=""` / `currentAnswer=""` | `min_length=1` | 400 |
| `personas=[]` | `min_length=1` | 400 |
| `currentAnswer` 너무 긴 입력 | `max_length=5000` | 400 |
| LLM API 오류 (네트워크·인증·타임아웃) | `LLMError` | 500 |
| LLM 응답 JSON 파싱 실패 | `LLMError` | 500 |
| LLM 응답 필수 키 없음 | `LLMError` (`_parse_object` required_keys) | 500 |
| 빈 큐 세션 종료 | LLM 없이 즉시 `sessionComplete=True` | 200 |
| `MAX_TURNS` 초과 | LLM 없이 즉시 `sessionComplete=True` | 200 |
| `MAX_FOLLOWUPS` 초과 | followup check 스킵, 다음 질문으로 강제 전환 | 200 |

---

## 프롬프트 출력 형식 통일

모든 면접 프롬프트를 배열 형식으로 통일 (Gemini가 배열로 반환하는 경향 반영).

| 파일 | 출력 형식 |
|------|---------|
| `interview_hr_v1.md` | `[{"question": ..., "personaLabel": "HR 담당자"}]` |
| `interview_tech_lead_v1.md` | `[{"question": ..., "personaLabel": "기술팀장"}]` |
| `interview_executive_v1.md` | `[{"question": ..., "personaLabel": "경영진"}]` |
| `interview_followup_v1.md` | `[{"shouldFollowUp": bool, "followupType": ..., "followupQuestion": ..., "reasoning": ...}]` |

`_parse_object(raw, required_keys)` 헬퍼가 배열이면 첫 원소 추출.

---

## 다음 진행 시 유의사항 (Next.js 서비스 팀)

엔진은 **완전 stateless** — 다음 기능을 Next.js 서비스에서 구현해야 실제 면접이 동작함.

### 필수 구현 항목

**1. 세션 상태 관리**
매 `/answer` 호출 시 아래 상태를 함께 전송해야 함:
```
resumeText       — 이력서 (처음부터 끝까지 동일)
history          — 완료된 Q&A 누적 배열
questionsQueue   — 이전 응답의 updatedQueue
currentQuestion  — 방금 받은 질문 텍스트
currentPersona   — 방금 받은 질문의 페르소나
```

**2. Supabase 테이블 (권장)**
```
interview_sessions  — session_id, user_id, status, resume_text, personas, created_at
interview_history   — session_id, turn, persona, question_type, question, answer
```
없으면 새로고침 시 세션 소실.

**3. 조기 종료 처리**
엔진에 종료 API 없음. 서비스에서 `status = 'aborted'`로 업데이트만 하면 됨.

**4. 면접 종료 시 마무리 멘트 없음**
엔진은 `sessionComplete: true`만 반환. 종료 메시지는 클라이언트(Next.js) UI에서 처리.
면접 결과 리포트는 **기능 07** (`POST /api/report/generate`) 연동 필요 — 답변 5개 이상 후 호출 가능 (별도 이슈).

**5. 엔진 동작 상수 (참고)**
| 상수 | 값 | 설명 |
|------|-----|------|
| `MAX_TURNS` | 10 | 총 면접 턴 수 |
| `MAX_FOLLOWUPS` | 2 | 동일 페르소나 꼬리질문 최대 횟수. 초과 시 자동 페르소나 전환 |

---

## main.py 변경

`RequestValidationError` 핸들러 메시지 일반화:
- 변경 전: `"파일이 필요합니다."` (PDF 업로드 전용 문구)
- 변경 후: `"요청 형식이 올바르지 않습니다."` (JSON 엔드포인트에도 적합)

---

## TDD 사이클 결과 (최종)

| 사이클 | 테스트 수 | 결과 |
|--------|-----------|------|
| 스키마 유효성 (unit) | 6 | PASS |
| 서비스 LLM mock (unit) | 11 | PASS |
| 라우터 통합 (integration) | 11 | PASS |
| 기존 리그레션 | 34 | PASS |
| **전체** | **62** | **PASS** |

```
pytest tests/ -q
62 passed, 1 warning in 1.48s
```
