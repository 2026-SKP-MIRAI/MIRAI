# [#40] feat: [engine] 기능 03+04 — 패널 면접 세션 + 꼬리질문 엔진 구현 — 테스트

> 작성: 2026-03-09

---

## 최종 결과

```
pytest tests/ -q
62 passed, 1 warning in 1.48s
```

전체 62개 통과. 리그레션(기존 테스트) 포함.

---

## 상태 범례

| 아이콘 | 의미 |
|--------|------|
| ⬜ | 미구현 |
| 🔴 | RED — 테스트 작성 완료, 실패 확인 |
| 🟢 | GREEN — 구현 완료, 테스트 통과 |
| ✅ | DONE — 리팩토링 완료 |
| ❌ | FAIL — 테스트 실패 (수정 필요) |

---

## 테스트 파일 구조

```
engine/tests/
├── unit/
│   └── services/
│       └── test_interview_service.py   ← 신규 (17개)
└── integration/
    └── test_interview_router.py        ← 신규 (11개 + parametrize 3개 = 실제 13개)
```

---

## 사이클 1 — 스키마 유효성

파일: `engine/tests/unit/services/test_interview_service.py`

| # | 테스트명 | 상태 | 비고 |
|---|----------|------|------|
| 1 | `test_interview_start_request_valid` | ✅ | `resumeText`, `mode` 기본값 "panel" |
| 2 | `test_interview_start_request_empty_resume_text` | ✅ | `resumeText=""` → `ValidationError` |
| 3 | `test_answer_request_valid` | ✅ | `currentQuestion`, `currentPersona`, `currentAnswer` 포함 |
| 4 | `test_answer_request_missing_fields` | ✅ | `resumeText` 누락 → `ValidationError` |
| 5 | `test_followup_request_valid` | ✅ | `persona="hr"` 정상 |
| 6 | `test_answer_response_next_question_optional` | ✅ | `nextQuestion=None` + `sessionComplete=True` 허용 |

---

## 사이클 2 — 서비스 단위 테스트 (LLM mock)

파일: `engine/tests/unit/services/test_interview_service.py`

mock 패치 경로: `"app.services.interview_service.OpenAI"`

**LLM 2회 호출 패턴** (꼬리질문 불필요 → 다음 질문 생성):
```python
make_mock_llm_side_effect([NO_FOLLOWUP_JSON, TECH_QUESTION_JSON])
```

| # | 테스트명 | 상태 | 비고 |
|---|----------|------|------|
| 7 | `test_start_returns_first_hr_question` | ✅ | `firstQuestion.persona=="hr"`, personaLabel, question 내용 |
| 8 | `test_start_returns_questions_queue` | ✅ | MAX_TURNS=10 → 큐 9개, 순서 (tech_lead → executive → ...) |
| 9 | `test_process_answer_returns_next_question` | ✅ | LLM 2회 (followup=false → next question), `sessionComplete=False` |
| 10 | `test_process_answer_session_complete_when_queue_empty` | ✅ | 빈 큐 → LLM 호출 없이 `sessionComplete=True` |
| 11 | `test_process_answer_nextQuestion_is_none_when_session_complete` | ✅ | 빈 큐 → `nextQuestion is None` |
| 12 | `test_process_answer_returns_followup_when_insufficient` | ✅ | `shouldFollowUp=True` → `type="follow_up"`, 큐 변경 없음 |
| 13 | `test_process_answer_skips_followup_at_max_followups` | ✅ | trailing 동일 페르소나 2개 → followup 스킵, `type="main"` 다음 질문 반환 |
| 14 | `test_process_answer_session_complete_at_max_turns` | ✅ | history 9개 → LLM 없이 즉시 `sessionComplete=True` |
| 15 | `test_followup_type_parses_llm_output[CLARIFY]` | ✅ | CLARIFY 파싱 |
| 16 | `test_followup_type_parses_llm_output[CHALLENGE]` | ✅ | CHALLENGE 파싱 |
| 17 | `test_followup_type_parses_llm_output[EXPLORE]` | ✅ | EXPLORE 파싱 |

---

## 사이클 3 — 라우터 통합 테스트

파일: `engine/tests/integration/test_interview_router.py`

### `POST /api/interview/start`

| # | 테스트명 | 상태 | 비고 |
|---|----------|------|------|
| 1 | `test_start_200_returns_first_question_and_queue` | ✅ | `firstQuestion.persona=="hr"`, `questionsQueue` 길이 9 |
| 2 | `test_start_400_missing_resume_text` | ✅ | `resumeText` 필드 없음 → 400 |
| 3 | `test_start_400_empty_resume_text` | ✅ | `resumeText=""` → 400 |

### `POST /api/interview/answer`

| # | 테스트명 | 상태 | 비고 |
|---|----------|------|------|
| 4 | `test_answer_200_next_question` | ✅ | LLM 2회(followup=false → next), `sessionComplete=False` |
| 5 | `test_answer_200_session_complete` | ✅ | 빈 큐 → `sessionComplete=True`, `nextQuestion=null` |
| 6 | `test_answer_200_followup` | ✅ | `shouldFollowUp=True` → `type="follow_up"`, 큐 길이 불변 |
| 7 | `test_answer_200_session_complete_at_max_turns` | ✅ | history 9개 → `sessionComplete=True` (LLM 없음) |
| 8 | `test_answer_400_missing_fields` | ✅ | `resumeText` 누락 → 400 |

### `POST /api/interview/followup`

| # | 테스트명 | 상태 | 비고 |
|---|----------|------|------|
| 9 | `test_followup_200` | ✅ | `followupType` in CLARIFY/CHALLENGE/EXPLORE |
| 10 | `test_followup_400_missing_fields` | ✅ | `persona`, `resumeText` 누락 → 400 |

### 공통 오류 처리

| # | 테스트명 | 상태 | 비고 |
|---|----------|------|------|
| 11 | `test_500_llm_error` | ✅ | LLM `side_effect=Exception` → 500 |

---

## 기존 테스트 리그레션 확인

| 파일 | 테스트 수 | 상태 |
|------|-----------|------|
| `tests/unit/parsers/test_pdf_parser.py` | 7 | ✅ |
| `tests/unit/services/test_llm_service.py` | 8 | ✅ |
| `tests/unit/services/test_output_parser.py` | 10 | ✅ |
| `tests/integration/test_resume_questions_route.py` | 9 | ✅ |
| `tests/unit/services/test_interview_service.py` | **17** | ✅ |
| `tests/integration/test_interview_router.py` | **11** | ✅ |
| **합계** | **62** | ✅ |

---

## 커버리지 정성 평가

| 케이스 | 테스트 여부 |
|--------|------------|
| 정상 응답 (200) | ✅ 각 엔드포인트 |
| 필수 필드 누락 (400) | ✅ 각 엔드포인트 |
| 빈 문자열 (400) | ✅ start (`resumeText=""`) |
| LLM 오류 (500) | ✅ start 대표 검증 |
| 빈 큐 세션 종료 | ✅ unit + integration 이중 검증 |
| `nextQuestion=None` 허용 | ✅ 스키마 + 통합 이중 검증 |
| followupType 3종 | ✅ parametrize로 전부 |
| 꼬리질문 반환 (`type="follow_up"`) | ✅ unit + integration |
| MAX_TURNS(10) 초과 종료 | ✅ unit + integration |
| MAX_FOLLOWUPS(2) 초과 시 강제 전환 | ✅ unit |
| 꼬리질문 시 큐 변경 없음 | ✅ integration |
