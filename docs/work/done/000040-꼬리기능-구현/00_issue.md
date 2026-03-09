# feat: [engine] 기능 03+04 — 패널 면접 세션 + 꼬리질문 엔진 구현

## 사용자 관점 목표
서비스(siw 등)가 엔진의 면접 API를 호출하여 HR·기술팀장·경영진 3인 패널 면접을 진행하고, 답변 품질에 따라 CLARIFY·CHALLENGE·EXPLORE 꼬리질문을 자동 생성할 수 있다.

## 배경
MVP 기능01(`/api/resume/questions`) 완료. 다음 단계는 그 질문으로 면접 세션을 진행하는 엔진 API. 꼬리질문(기능04)은 `/api/interview/answer` 응답에 내장이므로 기능03·04는 하나의 이슈로 묶어 구현한다. 이 이슈는 **engine 계층만** 다룬다. services/siw 연동은 별도 이슈.

**엔진 수정 금지** — 엔진 API 규격(`engine/.ai.md`)에 맞게 서비스 파트만 개발한다.

## 아키텍처 결정 (검토 완료)

> **엔진은 완전 stateless** — 세션·이력 저장은 SERVICE(Next.js + Supabase) 책임.
> 엔진은 매 호출마다 필요한 컨텍스트를 전부 요청 바디로 받아 처리 후 반환한다.
> `session_store.py` 불필요. 세션 ID는 SERVICE가 생성·관리.

```
[프론트엔드]
    ↓ sessionId + answer
[Next.js 서비스]
    ↓ Supabase에서 resumeText + history + questionsQueue 조회
    ↓ 엔진 호출 (풀 컨텍스트 전달)
[FastAPI 엔진] ← stateless, 저장 없음
    ↓ LLM 호출 → nextQuestion + updatedQueue 반환
[Next.js 서비스] → Supabase에 새 상태 저장
    ↓
[프론트엔드]
```

## 사전 검토 필수
- `engine/.ai.md` — 엔진 API 계약, 에러 코드, 예외 계층
- `docs/specs/mirai/dev_spec.md` — 기능 03·04 명세 §4

## API 명세 (Engine 수신 기준 — stateless)

### POST /api/interview/start

```json
// 요청 (SERVICE가 자소서 텍스트를 직접 전달)
{
  "resumeText": "자소서 전문...",
  "personas": ["hr", "tech_lead", "executive"],
  "mode": "panel"
}

// 응답 200 (SERVICE가 Supabase에 저장)
{
  "firstQuestion": {
    "persona": "hr",
    "personaLabel": "HR 담당자",
    "question": "자기소개와 함께 이 역할에 지원한 동기를 말씀해 주세요."
  },
  "questionsQueue": [
    { "persona": "hr", "type": "main" },
    { "persona": "tech_lead", "type": "main" },
    { "persona": "executive", "type": "main" }
  ]
}
```

### POST /api/interview/answer

```json
// 요청 (SERVICE가 Supabase에서 조회해 전달)
{
  "resumeText": "자소서 전문...",
  "history": [
    { "persona": "hr", "personaLabel": "HR 담당자", "question": "...", "answer": "..." }
  ],
  "questionsQueue": [
    { "persona": "tech_lead", "type": "main" },
    { "persona": "executive", "type": "main" }
  ],
  "currentAnswer": "..."
}

// 응답 200 (SERVICE가 updatedQueue를 Supabase에 저장)
{
  "nextQuestion": {
    "persona": "tech_lead",
    "personaLabel": "기술팀장",
    "question": "OO 프로젝트에서 사용한 기술 스택 선택 이유를 설명해 주세요.",
    "type": "follow_up"
  },
  "updatedQueue": [...],
  "sessionComplete": false
}
```

### POST /api/interview/followup

```json
// 요청
{
  "question": "팀 갈등을 해결한 경험을 말씀해 주세요.",
  "answer": "커뮤니케이션을 통해 해결했습니다.",
  "persona": "hr",
  "resumeText": "자소서 전문..."
}

// 응답 200
{
  "followupType": "CLARIFY",
  "followupQuestion": "구체적으로 어떤 방식의 커뮤니케이션을 사용하셨나요?",
  "reasoning": "답변이 너무 일반적이어서 구체적 방법론 확인 필요"
}
```

## 페르소나 정의 (dev_spec.md 기준)

| 페르소나 | 역할 | 검증 포인트 |
|--------|------|-----------|
| HR 담당자 | 조직 적합성·협업 태도·인성 | 경험의 맥락, 팀 내 역할, 가치관 |
| 기술팀장 | 직무 역량·문제 해결·기술 깊이 | 구체적 구현 방법, 기술 판단력 |
| 경영진 | 성장 가능성·비전·비즈니스 임팩트 | 장기적 기여 가능성, 전략적 사고 |

## 꼬리질문 유형 (dev_spec.md 기준)

| 유형 | 목적 | 생성 조건 |
|------|------|---------|
| CLARIFY | 불명확한 부분 재확인 | 답변에 모호한 표현, 주어 불명확, 수치 없음 |
| CHALLENGE | 논리적 근거 검증 | 주장만 있고 근거 없음, 일반론적 답변 |
| EXPLORE | 경험의 심층 탐색 | 흥미로운 경험 언급, 더 깊이 파고들 여지 있음 |

## 신규 파일 목록

```
engine/app/
├── schemas.py                        기존 확장 — Interview 관련 스키마 추가
├── services/
│   └── interview_service.py          start_interview / process_answer / generate_followup
├── prompts/
│   ├── interview_hr_v1.md            HR 담당자 system prompt
│   ├── interview_tech_lead_v1.md     기술팀장 system prompt
│   ├── interview_executive_v1.md     경영진 system prompt
│   └── interview_followup_v1.md      꼬리질문 판단 + 생성 프롬프트
└── routers/
    └── interview.py                  3개 엔드포인트 + main.py router 등록

engine/tests/
├── unit/services/test_interview_service.py
└── integration/test_interview_router.py
```

> **`session_store.py` 미포함** — 세션 관리는 SERVICE(Supabase) 책임. 엔진은 stateless.
> **프롬프트는 `.md` 파일** — 기존 `question_generation_v1.md` 패턴과 통일.

## TDD 구현 순서 (Red → Green → Refactor)

### 사이클 1 — 스키마 유효성

```python
def test_interview_start_request_valid(): ...
def test_interview_start_request_missing_resume_text(): ...   # resumeText 없으면 400
def test_interview_start_request_empty_resume_text(): ...     # 빈 문자열 400
def test_answer_request_valid(): ...
def test_answer_request_missing_fields(): ...
def test_followup_request_valid(): ...
```

### 사이클 2 — interview_service (LLM mock)

> patch 경로: `"app.services.interview_service.OpenAI"` (interview_service가 직접 클라이언트 생성하는 경우)
> 또는 `llm_service` 경유 시 `"app.services.llm_service.OpenAI"` — 구현 시 결정

```python
def test_start_returns_first_hr_question(mock_llm): ...
def test_start_returns_questions_queue(mock_llm): ...
def test_process_answer_returns_followup_when_vague(mock_llm): ...
def test_process_answer_returns_next_question_when_sufficient(mock_llm): ...
def test_process_answer_session_complete_when_queue_empty(mock_llm): ...
@pytest.mark.parametrize("followup_type", ["CLARIFY", "CHALLENGE", "EXPLORE"])
def test_followup_type_parses_llm_output(mock_llm, followup_type): ...
```

### 사이클 3 — 라우터 통합 테스트 (TestClient)

```python
def test_start_200_returns_first_question_and_queue(): ...
def test_start_400_missing_resume_text(): ...
def test_start_400_empty_resume_text(): ...
def test_answer_200_with_followup(): ...
def test_answer_200_next_question(): ...
def test_answer_200_session_complete(): ...
def test_answer_400_missing_fields(): ...
def test_followup_200(): ...
def test_followup_400_missing_fields(): ...
def test_500_llm_error(): ...
```

> **세션 격리 픽스처 불필요** — 엔진이 stateless이므로 테스트 간 상태 오염 없음.
> **404 케이스 없음** — sessionId를 엔진이 관리하지 않으므로 404 불가. 잘못된 입력은 400 처리.

## 완료 기준

- [x] `POST /api/interview/start` — resumeText + personas 받아 첫 질문(HR) + questionsQueue 반환
- [x] `POST /api/interview/answer` — history + questionsQueue + currentAnswer 받아 꼬리질문(내장) 또는 다음 본 질문 반환
- [x] `POST /api/interview/followup` — question + answer + persona 받아 CLARIFY·CHALLENGE·EXPLORE 꼬리질문 반환
- [x] 페르소나 3종 system prompt `.md` 파일 (HR·기술팀장·경영진)
- [x] 꼬리질문 유형 판단 + 생성 프롬프트 `.md` 파일
- [x] TDD: 모든 구현은 pytest Red → Green → Refactor 사이클로 작성 (62 passed)
- [x] `engine/.ai.md` 최신화
- [x] 불변식 준수: LLM 호출은 `engine/services/`에서만, `session_store.py` 없음

## 기술 스택 (dev_spec.md 기준, 신규 추가 없음)

- FastAPI + Pydantic v2 — 기존과 동일
- LLM: OpenRouter (`google/gemini-2.5-flash`) — 기존 `llm_service.py` 패턴 재사용
- 테스트: pytest + pytest-asyncio + unittest.mock — 기존과 동일

## 개발 체크리스트

- [ ] 테스트 코드 포함 (pytest, LLM mock 처리)
- [ ] 해당 디렉토리 `.ai.md` 최신화
- [ ] 불변식 위반 없음 (LLM 호출은 `services/`에서만)
- [ ] `session_store.py` 없음 — stateless 확인

---

## 작업 내역

### 신규 파일

**`engine/app/services/interview_service.py`**
핵심 비즈니스 로직. 3개 퍼블릭 함수 + 5개 내부 헬퍼.
- `start_interview`: personas[0]으로 첫 질문 생성(LLM 1회) + `_build_queue`로 round-robin 9개 큐 생성
- `process_answer`: MAX_TURNS 초과·빈 큐 즉시 종료(LLM 0회), `_count_trailing_persona`로 MAX_FOLLOWUPS(2) 제한, `_check_followup`으로 꼬리질문 판단(LLM 1회), 다음 질문 생성(LLM 1회)
- `generate_followup`: `_check_followup` 재사용 → `FollowupResponse` 반환
- `_parse_object`: LLM 응답이 배열로 올 경우 첫 원소 추출 (Gemini 응답 특성 반영)

**`engine/app/routers/interview.py`**
3개 엔드포인트 얇은 라우터. 검증(Pydantic) → 서비스 호출 → 반환.

**프롬프트 4종** (`engine/app/prompts/`)
- `interview_hr/tech_lead/executive_v1.md`: 페르소나별 첫 질문 생성. JSON 배열 출력 형식.
- `interview_followup_v1.md`: CLARIFY·CHALLENGE·EXPLORE 판단 + 꼬리질문 생성.

**테스트 2종**
- `tests/unit/services/test_interview_service.py`: 17개 (스키마 6 + 서비스 로직 11)
- `tests/integration/test_interview_router.py`: 11개 (라우터 HTTP 계층)

### 수정 파일

**`engine/app/schemas.py`**: `Field` import 추가, Interview 스키마 7종 추가. `InterviewAnswerRequest`에 `currentQuestion`·`currentPersona` 추가 (stateless 설계 반영).

**`engine/app/main.py`**: interview router 등록. `RequestValidationError` 메시지 일반화 (`"파일이 필요합니다."` → `"요청 형식이 올바르지 않습니다."`).

**`engine/.ai.md`**: 신규 엔드포인트 3개 계약 추가.

### 주요 설계 결정

1. **MAX_TURNS=10, MAX_FOLLOWUPS=2**: 10턴 면접, 동일 페르소나 꼬리질문 최대 2회 제한 후 자동 전환
2. **배열 파싱**: Gemini가 JSON 배열로 반환하는 경향 있어 `_parse_object`에서 배열이면 첫 원소 추출
3. **꼬리질문 LLM 결과 재사용**: `_check_followup` 반환값에 `followupQuestion` 포함시켜 꼬리질문 발동 시 추가 LLM 호출 없음
4. **stateless**: `session_store.py` 없음. 매 `/answer` 호출 시 클라이언트가 `history`, `questionsQueue`, `currentQuestion`, `currentPersona` 전체 전달

