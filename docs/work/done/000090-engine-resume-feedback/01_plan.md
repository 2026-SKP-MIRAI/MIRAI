# [#90] feat: [engine] 기능 02 — 이력서·자소서 피드백 및 강점·약점 분석 엔진 구현 (POST /api/resume/feedback) — 구현 계획

> 작성: 2026-03-13

---

## 완료 기준 (AC)

- [x] `POST /api/resume/feedback` — `{ resumeText, targetRole }` 입력 시 200 반환
- [x] `scores` 5개 항목 (specificity, achievementClarity, logicStructure, roleAlignment, differentiation) 각 0~100 정수, clamp 보정 포함
- [x] `strengths` 2~3개 · `weaknesses` 2~3개 · `suggestions` 배열 반환 (각 항목: `{ section, issue, suggestion }`)
- [x] `resumeText`/`targetRole` 누락·빈값 → 400, LLM 오류 → 500
- [x] `engine/.ai.md`에 `/api/resume/feedback` 엔드포인트 계약 추가
- [x] `engine/app/services/.ai.md`, `routers/.ai.md`, `prompts/.ai.md` 최신화
- [x] 단위 테스트 12개 이상 + 통합 테스트 8개 이상 모두 통과
- [x] 불변식 위반 없음 (LLM 호출은 `services/`에서만, engine stateless 유지)

---

## 아키텍처 개요

### 신규 생성 파일 (4개)

| 파일 | 목적 |
|------|------|
| `engine/app/services/feedback_service.py` | 이력서 피드백 비즈니스 로직 (`report_service.py` 패턴 동일) |
| `engine/app/prompts/resume_feedback_v1.md` | 자소서 5개 항목 진단 프롬프트 |
| `engine/tests/unit/services/test_feedback_service.py` | 서비스 단위 테스트 12개 |
| `engine/tests/integration/test_resume_feedback_router.py` | 라우터 통합 테스트 8개 |

### 수정 파일 (7개)

| 파일 | 변경 내용 |
|------|-----------|
| `engine/app/parsers/exceptions.py` | `ResumeFeedbackParseError(LLMError)` 추가 |
| `engine/app/schemas.py` | 4개 스키마 추가 |
| `engine/app/routers/resume.py` | `POST /feedback` 엔드포인트 추가 |
| `engine/.ai.md` | `/api/resume/feedback` 계약 + 예외 계층 추가 |
| `engine/app/services/.ai.md` | `feedback_service.py` 항목 추가 |
| `engine/app/routers/.ai.md` | `resume.py` 설명에 `/feedback` 추가 |
| `engine/app/prompts/.ai.md` | `resume_feedback_v1.md` 버전 이력 추가 |

### 예외 계층

```
LLMError (독립)                    → HTTP 500
├── ReportParseError               → HTTP 500
├── PracticeParseError             → HTTP 500
└── ResumeFeedbackParseError  ← NEW → HTTP 500 (기존 handle_500 핸들러 자동 포착)
```

**중요:** `ResumeFeedbackParseError`는 `LLMError` 하위 클래스이므로 `main.py`에 별도 exception handler 추가 불필요.

---

## 설계 결정

| 결정 | 선택 | 이유 |
|------|------|------|
| fixture 관리 | inline JSON mock | `fixtures/output/` JSON 파일이 현재 미커밋 — 파일 의존 없이 테스트 독립성 보장 |
| strengths/weaknesses 최솟값 | 서비스에서 2개 보장 | Pydantic `min_length=2` 제약 — LLM이 1개 이하 반환 시 ValidationError 방지 |
| 로깅 | `logger.info(...)` 추가 | 기존 `/questions` 엔드포인트 패턴과 일관성 유지 |
| main.py 수정 | 불필요 | `resume.py`가 이미 `APIRouter(prefix="/resume")`로 `/api`에 등록됨 |

---

## 스키마 설계 (`schemas.py` 추가)

```python
class ResumeFeedbackScores(BaseModel):
    specificity:        int = Field(..., ge=0, le=100)
    achievementClarity: int = Field(..., ge=0, le=100)
    logicStructure:     int = Field(..., ge=0, le=100)
    roleAlignment:      int = Field(..., ge=0, le=100)
    differentiation:    int = Field(..., ge=0, le=100)

class SuggestionItem(BaseModel):
    section:    str
    issue:      str
    suggestion: str

class ResumeFeedbackRequest(BaseModel):
    resumeText: str = Field(..., min_length=1)
    targetRole: str = Field(..., min_length=1)

class ResumeFeedbackResponse(BaseModel):
    scores:      ResumeFeedbackScores
    strengths:   list[str] = Field(..., min_length=2, max_length=3)
    weaknesses:  list[str] = Field(..., min_length=2, max_length=3)
    suggestions: list[SuggestionItem]
```

---

## 에러 처리 매트릭스

| 상황 | 예외 | HTTP | 처리 위치 |
|------|------|------|-----------|
| `resumeText`/`targetRole` 누락·빈 문자열 | `RequestValidationError` | 400 | `main.py handle_validation_error` |
| LLM API 호출 실패 | `LLMError` | 500 | `main.py handle_500` |
| LLM 응답 JSON 파싱 실패 | `ResumeFeedbackParseError(LLMError)` | 500 | `main.py handle_500` (상속 자동 포착) |
| 점수 범위 초과·텍스트 누락 | — | 200 | `_parse_feedback` 내부 fallback |

---

## 구현 계획 (7단계)

### 1단계 — 스키마 + 예외 정의

**수정 파일:** `engine/app/schemas.py`, `engine/app/parsers/exceptions.py`

위의 스키마 설계 섹션 코드를 `schemas.py` 맨 아래에 추가.
`exceptions.py` 마지막 줄에 추가:
```python
class ResumeFeedbackParseError(LLMError): pass
```

---

### 2단계 — 프롬프트 작성 (`resume_feedback_v1.md`)

- 역할: "채용 전문 서류 컨설턴트"
- 플레이스홀더: `{resume_text}`, `{target_role}`
- 5개 진단 항목 정의 (specificity·achievementClarity·logicStructure·roleAlignment·differentiation)
- JSON only 출력, strengths 2~3개, weaknesses 2~3개, suggestions 배열

---

### 3단계 — `feedback_service.py` 구현

`report_service.py` 패턴 동일 적용. **핵심 — strengths/weaknesses 2개 보장:**

```python
def _safe_list(key: str, fallback: str) -> list[str]:
    raw = [str(x) for x in data.get(key, []) if str(x).strip()][:3]
    return raw if len(raw) >= 2 else raw + [fallback] * (2 - len(raw))

strengths  = _safe_list("strengths",  "강점을 확인하지 못했습니다")
weaknesses = _safe_list("weaknesses", "약점을 확인하지 못했습니다")
```

| 항목 | `report_service.py` | `feedback_service.py` |
|------|--------------------|-----------------------|
| `_clamp()` | 동일 | 동일 |
| `_build_prompt()` | resume + history | resume_text + target_role |
| `_parse_*()` | `_parse_report()` | `_parse_feedback()` |
| 예외 | `ReportParseError` | `ResumeFeedbackParseError` |
| LLM timeout | 60s | 30s |
| max_tokens | 2048 | 2048 |

---

### 4단계 — 라우터 (`resume.py`에 추가)

```python
@router.post("/feedback", response_model=ResumeFeedbackResponse)
async def create_feedback(body: ResumeFeedbackRequest):
    logger.info("[resume/feedback] 요청 수신: resumeText 길이=%d, targetRole=%s",
                len(body.resumeText), body.targetRole)
    return generate_resume_feedback(body.resumeText, body.targetRole)
```

`main.py` 수정 불필요 — resume router가 이미 `/api` prefix로 등록됨.

---

### 5단계 — TDD 테스트 작성

**mock 헬퍼:**
```python
def make_mock_llm(content: str):
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=content))
    ]
    return fake

def _feedback_json(**overrides) -> str:
    base = {
        "scores": {"specificity": 72, "achievementClarity": 65,
                   "logicStructure": 80, "roleAlignment": 88, "differentiation": 60},
        "strengths": ["직무 연관성 명확", "논리 구조 우수"],
        "weaknesses": ["수치 근거 부족", "차별화 요소 약함"],
        "suggestions": [{"section": "성장 경험", "issue": "수치 없음", "suggestion": "30% 개선 등 수치 추가"}]
    }
    base.update(overrides)
    return json.dumps(base)
```

**단위 테스트 12개** (`test_feedback_service.py`):

| # | 함수명 | 검증 내용 |
|---|--------|-----------|
| 1 | `test_generate_resume_feedback_returns_valid_response` | 정상 응답 구조 (scores, strengths, weaknesses, suggestions) |
| 2 | `test_generate_resume_feedback_scores_within_range` | 5개 점수 모두 0-100 범위 |
| 3 | `test_generate_resume_feedback_strengths_count` | strengths 2~3개 |
| 4 | `test_generate_resume_feedback_weaknesses_count` | weaknesses 2~3개 |
| 5 | `test_generate_resume_feedback_suggestions_structure` | suggestions 항목에 section·issue·suggestion 키 존재 |
| 6 | `test_generate_resume_feedback_score_clamped_over_100` | score=105 → 100 clamp |
| 7 | `test_generate_resume_feedback_score_clamped_negative` | score=-5 → 0 clamp |
| 8 | `test_generate_resume_feedback_strengths_truncated_to_3` | strengths 4개 → 3개 슬라이싱 |
| 9 | `test_generate_resume_feedback_weaknesses_truncated_to_3` | weaknesses 4개 → 3개 슬라이싱 |
| 10 | `test_generate_resume_feedback_empty_strengths_uses_fallback` | strengths=[] → fallback 2개 보장 |
| 11 | `test_generate_resume_feedback_llm_error_raises_llm_error` | LLM API 오류 → `LLMError` raise |
| 12 | `test_generate_resume_feedback_invalid_json_raises_parse_error` | 잘못된 JSON → `ResumeFeedbackParseError` raise |

**통합 테스트 8개** (`test_resume_feedback_router.py`):

| # | 함수명 | HTTP | 검증 내용 |
|---|--------|------|-----------|
| 13 | `test_resume_feedback_200_full_fields` | 200 | scores·strengths·weaknesses·suggestions 전체 존재 |
| 14 | `test_resume_feedback_200_scores_five_keys` | 200 | scores 5개 키 모두 존재 |
| 15 | `test_resume_feedback_400_missing_resume_text` | 400 | resumeText 누락 |
| 16 | `test_resume_feedback_400_missing_target_role` | 400 | targetRole 누락 |
| 17 | `test_resume_feedback_400_empty_resume_text` | 400 | resumeText="" |
| 18 | `test_resume_feedback_400_empty_target_role` | 400 | targetRole="" |
| 19 | `test_resume_feedback_500_llm_error` | 500 | LLM mock side_effect → 500 |
| 20 | `test_resume_feedback_500_parse_error` | 500 | 잘못된 JSON 응답 → 500 |

---

### 6단계 — `.ai.md` 최신화

| 파일 | 업데이트 내용 |
|------|-------------|
| `engine/.ai.md` | `/api/resume/feedback` 계약 + 예외 계층 트리에 `ResumeFeedbackParseError` 추가 |
| `engine/app/services/.ai.md` | `feedback_service.py` 항목 추가 |
| `engine/app/routers/.ai.md` | `resume.py` 설명에 `/feedback` 추가 |
| `engine/app/prompts/.ai.md` | `resume_feedback_v1.md` 버전 이력 추가 |
| `engine/app/parsers/.ai.md` | 예외 계층에 `ResumeFeedbackParseError` 추가 |
| `engine/tests/.ai.md` | `test_feedback_service.py`, `test_resume_feedback_router.py` 항목 추가 |

---

### 7단계 — `02_test.md` 작성

테스트 현황 문서 작성 (단위 12 + 통합 8 = 20개 목록, GREEN 확인 후 체크).

---

## 구현 의존성 그래프

```
1단계 (스키마+예외)
    ↓
2단계 (프롬프트)  ←→  3단계 (서비스) — 병렬 작업 가능
                              ↓
                       4단계 (라우터)
                              ↓
                       5단계 (테스트 전체 통과)
                              ↓
                    6단계 (.ai.md 최신화) → 7단계 (02_test.md)
```

> 2단계와 3단계는 병렬 작업 가능 — 서비스 구현 시 프롬프트 파일은 mock으로 대체 가능

---

## Red → Green → Refactor

### Phase 1 — Red (테스트 먼저 작성)
1. `exceptions.py`에 `ResumeFeedbackParseError` 추가
2. `schemas.py`에 4개 모델 추가
3. 단위 테스트 12개 작성 → import 실패 / service 없음 = **Red**
4. 통합 테스트 8개 작성 → 404 = **Red**

### Phase 2 — Green (최소 구현)
5. 프롬프트 파일 작성
6. `feedback_service.py` 구현
7. `resume.py`에 `/feedback` 엔드포인트 추가
8. `pytest tests/ -x` → **Green**

### Phase 3 — Refactor
9. `_parse_feedback` 로직 정리 (필요 시)
10. `.ai.md` 4개 최신화
11. `pytest tests/ -v` → 기존 회귀 없이 전체 통과 확인
12. `02_test.md` 작성

---

## 불변식 검증

- [ ] **LLM API 호출은 engine/services/ 에서만** — `feedback_service.py`는 `llm_client.call_llm` 사용
- [ ] **인증 로직 없음** — `ResumeFeedbackRequest`에 user/auth 필드 없음
- [ ] **stateless** — 전역 가변 상태 없음, DB 접근 없음
- [ ] **서비스 간 직접 통신 금지** — 엔진은 독립 API 제공만
- [ ] **테스트 없는 PR 머지 금지** — 단위 12개 + 통합 8개 필수
