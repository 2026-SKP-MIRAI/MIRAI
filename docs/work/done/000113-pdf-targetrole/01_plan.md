# [#113] targetRole 자동 추출 — 구현 플랜

> 작성: 2026-03-19

---

## 1. 파일 목록

### 신규

| 파일 | 목적 |
|------|------|
| `engine/app/prompts/target_role_v1.md` | targetRole 추출 전용 프롬프트 |
| `engine/app/services/role_service.py` | `extract_target_role()` |
| `engine/tests/unit/services/test_role_service.py` | 단위 테스트 8개 |
| `engine/tests/integration/test_resume_target_role_route.py` | 통합 테스트 5개 |
| `engine/tests/integration/test_resume_analyze_route.py` | 통합 테스트 7개 |

### 수정

| 파일 | 변경 내용 |
|------|-----------|
| `engine/app/schemas.py` | `TargetRoleRequest`, `TargetRoleResponse`, `AnalyzeResponse` 추가. `ResumeFeedbackRequest.targetRole` optional(`str \| None`)로 변경 |
| `engine/app/routers/resume.py` | `/analyze`, `/target-role` 추가. `_validate_and_parse_pdf()` 헬퍼 추출(DRY). `/feedback` 핸들러 수정 |
| `engine/app/services/llm_service.py` | `call_llm()` 사용으로 리팩토링 (OpenAI 직접 호출 제거) |
| `engine/app/services/feedback_service.py` | `generate_resume_feedback(target_role: str \| None = None)` optional 처리 |
| `engine/tests/unit/services/test_llm_service.py` | mock 경로 → `app.services.llm_client.OpenAI` |
| `engine/tests/integration/test_resume_questions_route.py` | mock 경로 → `app.services.llm_client.OpenAI` |
| `engine/tests/integration/test_resume_feedback_router.py` | targetRole optional 테스트 추가, 중복 테스트 제거 |
| `engine/app/schemas.py QuestionsRequest` | `targetRole: str \| None = Field(None, max_length=100)` 추가 — 직무 맞춤 질문 생성 지원 |
| `engine/tests/integration/test_resume_questions_route.py` | `test_200_with_target_role`, `test_400_target_role_too_long` 추가. mock 경로 수정 |
| `engine/tests/unit/services/test_llm_service.py` | `generate_questions` target_role 주입 테스트 2개 추가 |
| `engine/.ai.md` | `/analyze`, `/target-role` 계약 추가, `/feedback` 입력 업데이트, timeout 주의 추가 |
| `engine/app/services/.ai.md` | `role_service.py` 항목 추가 |
| `engine/app/prompts/.ai.md` | `target_role_v1.md` 항목 추가 |
| `engine/app/routers/.ai.md` | `/analyze`, `/target-role` 추가 |

### 변경 없음

| 파일 | 이유 |
|------|------|
| `output_parser.py` | 변경 없음 |
| `question_generation_v1.md` | 변경 없음 |
| `pdf_parser.py` | 파싱 로직 변경 없음 |

---

## 2. 상세 설계

### 2-A. role_service.py

**프롬프트** — `engine/app/prompts/target_role_v1.md`:
- 명시 직무 우선 → 키워드 추론 → 불가 시 "미지정"
- JSON 객체만 반환: `{"targetRole": "직무명"}`

**서비스** — `engine/app/services/role_service.py`:
```python
def extract_target_role(
    resume_text: str,
    *,
    model: str | None = None,
    max_input_chars: int = 16000,
    timeout_seconds: float = 15.0,
) -> str:
    if not resume_text or not resume_text.strip():
        raise LLMError("resume_text가 비어 있습니다.")
    truncated = resume_text[:max_input_chars]
    prompt = PROMPT_FILE.read_text(encoding="utf-8").replace("{resume_text}", truncated)
    raw = call_llm(prompt, model=model, timeout=timeout_seconds, max_tokens=128,
                   error_message="직무 추론 중 오류가 발생했습니다.")
    data = parse_object(raw, required_keys=["targetRole"])
    role = data["targetRole"]
    if not isinstance(role, str) or not role.strip():
        return "미지정"
    return role.strip()[:100]  # Pydantic max_length=100 초과 방지
```

### 2-B. POST /api/resume/analyze

```
입력: multipart/form-data (file: PDF)
출력: { resumeText: str, extractedLength: int, targetRole: str }
에러: 400 (파일없음·비PDF·크기초과·페이지초과), 422 (빈PDF·OCR실패), 500 (LLM오류)
비고: targetRole 추론 불가 시 "미지정" 반환. 내부 LLM timeout=15s
```

### 2-C. POST /api/resume/target-role

```
입력: { resumeText: str } (min 1자, max 50,000자)
출력: { targetRole: str }
에러: 400 (resumeText 누락/빈값/50,000자 초과), 500 (LLM오류)
비고: 추론 불가 시 "미지정" 반환
```

### 2-D. /feedback targetRole optional 처리

**스키마:**
```python
class ResumeFeedbackRequest(BaseModel):
    resumeText: str = Field(..., min_length=1)
    targetRole: str | None = Field(None, description="미입력·빈값 시 '미지정 직무'로 처리")
```

**서비스:**
```python
def generate_resume_feedback(resume_text: str, target_role: str | None = None, ...) -> ...:
    role_label = target_role.strip() if target_role and target_role.strip() else "미지정 직무"
```

### 2-E. _validate_and_parse_pdf 헬퍼

`/parse`와 `/analyze`의 PDF 검증·파싱 중복 로직 제거:
```python
async def _validate_and_parse_pdf(request, file, endpoint) -> ParsedResume:
    # 파일 없음 / 비PDF / content-length 초과 검사
    # +1024: multipart 경계 헤더 오버헤드 여유 마진
    # parse_pdf() 호출 후 ParsedResume 반환
```

---

## 3. 테스트

### test_role_service.py (8개)

| # | 테스트명 | 기대 |
|---|---------|------|
| 1 | `test_extract_target_role_success` | `"경영기획"` 반환 |
| 2 | `test_extract_target_role_strips_whitespace` | `"백엔드"` 반환 |
| 3 | `test_extract_target_role_fallback_when_empty` | `"미지정"` 반환 |
| 4 | `test_extract_target_role_fallback_when_null` | `"미지정"` 반환 |
| 5 | `test_extract_target_role_raises_when_resume_text_is_empty` | LLMError |
| 6 | `test_extract_target_role_raises_when_resume_text_is_whitespace` | LLMError |
| 7 | `test_extract_target_role_api_error` | LLMError |
| 8 | `test_extract_target_role_truncates_long_text` | 16000자 잘림 확인 |

**mock 경로:** `patch("app.services.role_service.call_llm", ...)`

### test_resume_target_role_route.py (5개)

| # | 테스트명 | 기대 |
|---|---------|------|
| 1 | `test_200_target_role_success` | `{"targetRole": "경영기획"}` |
| 2 | `test_200_target_role_fallback_when_undetectable` | `{"targetRole": "미지정"}` |
| 3 | `test_400_missing_resume_text` | 400 |
| 4 | `test_400_empty_resume_text` | 400 |
| 5 | `test_500_llm_error` | 500 |

> ⚠️ **mock 경로:** `patch("app.routers.resume.extract_target_role", ...)`

### test_resume_analyze_route.py (7개)

| # | 테스트명 | 기대 |
|---|---------|------|
| 1 | `test_200_analyze_success` | `{ resumeText, extractedLength, targetRole }` |
| 2 | `test_200_analyze_target_role_fallback` | targetRole `"미지정"` |
| 3 | `test_400_no_file` | 400 |
| 4 | `test_400_non_pdf` | 400 |
| 5 | `test_500_llm_error` | 500 |
| 6 | `test_422_empty_pdf` | 422 |
| 7 | `test_422_image_only_pdf` | 422 |

> ⚠️ **mock 경로:** `patch("app.routers.resume.parse_pdf", ...)` + `patch("app.routers.resume.extract_target_role", ...)`

---

## 4. TDD 구현 순서

### Phase 1: role_service + /target-role

- [x] Step 1: `test_role_service.py` 단위 테스트 작성 (RED)
- [x] Step 2: `target_role_v1.md` 프롬프트 작성
- [x] Step 3: `role_service.py` 구현 (GREEN)
- [x] Step 4: `TargetRoleRequest`, `TargetRoleResponse` 스키마 추가
- [x] Step 5: `test_resume_target_role_route.py` 통합 테스트 작성 (RED)
- [x] Step 6: `/target-role` 엔드포인트 추가 (GREEN)
- [x] Step 7: 테스트 PASS 확인

### Phase 2: /analyze

- [x] Step 8: `AnalyzeResponse` 스키마 추가
- [x] Step 9: `test_resume_analyze_route.py` 통합 테스트 작성 (RED)
- [x] Step 10: `/analyze` 엔드포인트 추가 (GREEN)
- [x] Step 11: 테스트 PASS 확인

### Phase 3: /feedback targetRole optional

- [x] Step 12: `test_resume_feedback_router.py`에 targetRole optional 테스트 추가 (RED)
- [x] Step 13: `ResumeFeedbackRequest.targetRole` optional 변경 + `feedback_service.py` 수정 (GREEN)
- [x] Step 14: 테스트 PASS 확인

### Phase 4: 문서 및 리팩토링

- [x] Step 15: `engine/.ai.md` 업데이트
- [x] Step 16: 관련 `.ai.md` 업데이트
- [x] Step 17: `llm_service.py` → `call_llm()` 리팩토링
- [x] Step 18: `_validate_and_parse_pdf()` 헬퍼 추출 (DRY)
- [x] Step 19: 전체 테스트 실행 — 138 passed ✅

---

## 5. 검증 메모 (2026-03-19 validate-all 결과)

### 아키텍처 불변식

| 불변식 | 상태 |
|--------|------|
| LLM 호출은 `services/`에서만 | ✅ |
| PDF 파싱은 `parsers/`에서만 | ✅ |
| engine stateless | ✅ |
| 테스트 없는 PR 금지 | ✅ 20개+ 신규/추가 |

### 하위 호환성

- 기존 `/parse` → 변경 없음
- `/questions` → targetRole optional 추가 (breaking change 없음 — 미입력 시 기존 동작 유지)
- `/feedback` → targetRole optional로 변경 (breaking change 없음, 기존 필수값도 동작)
- 기존 서비스 (siw/seung/lww/kwan) breaking change 없음

### 테스트 커맨드

```bash
cd engine && python -m pytest tests/unit/services/test_role_service.py -v
cd engine && python -m pytest tests/integration/test_resume_target_role_route.py -v
cd engine && python -m pytest tests/integration/test_resume_analyze_route.py -v
cd engine && python -m pytest -v  # 전체 회귀
```
