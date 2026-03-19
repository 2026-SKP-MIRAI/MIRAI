# feat: [기능 01·02 고도화] targetRole 자동 추출 (/analyze, /target-role 신규 엔드포인트)

> 이슈: #113
> 브랜치: feat/000113-pdf-targetrole

---

## 사용자 관점 목표

자소서 PDF를 업로드하면 지원 직무를 자동으로 추론하고, 사용자가 확인/수정한 뒤
자소서 피드백과 면접 질문 생성을 병렬로 받을 수 있다.

## 배경

현재 사용자가 `/feedback`을 받으려면 `targetRole`을 직접 입력해야 한다.
자소서 본문에 이미 직무 정보가 포함되어 있으므로 별도 입력은 불필요한 단계다.

또한 PDF 업로드 후 resumeText와 targetRole을 한 번에 받을 수단이 없어
프론트엔드에서 `/parse` → 별도 추론 두 번 호출해야 하는 문제가 있다.

## 프론트엔드 플로우 (목표)

```
PDF 업로드
    ↓
POST /analyze → { resumeText, extractedLength, targetRole }   (~7s)
    ↓
"직무: 경영기획으로 면접?" → 사용자 확인/수정 → targetRole 확정
    ↓
POST /feedback  ||  POST /questions                           (~15s, 병렬)
    ↓
자소서 피드백 표시 + 면접 시작 버튼
```

## 구현 범위

| # | 내용 | 유형 |
|---|------|------|
| 1 | `POST /api/resume/analyze` — PDF → resumeText + targetRole 동시 반환 | 신규 |
| 2 | `POST /api/resume/target-role` — resumeText → targetRole 단독 반환 (재추출용) | 신규 |
| 3 | `/api/resume/feedback`의 `targetRole` optional 처리 — 미입력 시 `"미지정 직무"`로 처리 | 변경 |

## API 계약

### POST /api/resume/analyze
```
입력: multipart/form-data (file: PDF)
출력: { resumeText: str, extractedLength: int, targetRole: str }
에러: 400 (파일없음·비PDF·크기초과), 422 (빈PDF·OCR실패), 500 (LLM오류)
비고: targetRole 추론 불가 시 "미지정" 반환 (에러 아님)
```

### POST /api/resume/target-role
```
입력: { resumeText: str }  (min 1자, max 50,000자)
출력: { targetRole: str }
에러: 400 (resumeText 누락/빈값), 500 (LLM오류)
비고: 추론 불가 시 "미지정" 반환
```

### POST /api/resume/feedback (변경)
```
입력: { resumeText: str, targetRole?: str }   ← targetRole optional로 변경
출력: 기존과 동일
비고: targetRole 미입력 시 "미지정 직무"로 처리
```

## 완료 기준

- [x] `POST /api/resume/analyze` — PDF → resumeText + targetRole. 추론 불가 시 `"미지정"`
- [x] `POST /api/resume/target-role` — resumeText → targetRole 단독 추출. 추론 불가 시 `"미지정"`
- [x] `/api/resume/feedback`의 `targetRole` optional 처리 (미입력 시 `"미지정 직무"` fallback)
- [x] TDD — 신규 서비스·엔드포인트 단위+통합 테스트 포함
- [x] `engine/.ai.md` + 관련 `.ai.md` 최신화

## 개발 체크리스트

- [x] 테스트 코드 포함
- [x] 해당 디렉토리 `.ai.md` 최신화
- [x] 불변식 위반 없음 (LLM 호출 → `services/`, PDF 파싱 → `parsers/`)

---

## 작업 내역

### 신규 파일

- **`engine/app/prompts/target_role_v1.md`**: 직무 추출 전용 프롬프트. 명시 직무 우선 → 키워드 추론 → 불가 시 "미지정" 반환. `{"targetRole": "직무명"}` JSON만 출력하도록 설계.

- **`engine/app/services/role_service.py`**: `extract_target_role()` 서비스. `call_llm` + `parse_object` 사용. 빈 문자열·null → "미지정" 폴백. 반환값 `[:100]` 트런케이션으로 Pydantic `max_length=100` 초과 방지. 빈 resumeText 입력 시 `LLMError` 선제 발생.

- **`engine/tests/unit/services/test_role_service.py`**: 8개 단위 테스트. 성공·공백 트림·빈값 폴백·null 폴백·빈 입력 오류·공백 입력 오류·API 오류·16,000자 트런케이션 전 케이스 커버.

- **`engine/tests/integration/test_resume_target_role_route.py`**: 5개 통합 테스트. 200 성공·200 미지정 폴백·400 누락·400 빈값·500 LLM 오류.

- **`engine/tests/integration/test_resume_analyze_route.py`**: 7개 통합 테스트. 200 성공·200 미지정 폴백·400 파일없음·400 비PDF·500 LLM 오류·422 빈PDF·422 이미지전용PDF.

- **`docs/work/done/000113-pdf-targetrole/01_plan.md`**: 구현 플랜 (Phase 1-4 전체 완료 기록).

- **`docs/work/done/000113-pdf-targetrole/02_test.md`**: 테스트 결과 보고서. 142 passed, validate-all 3차 CRITICAL 0.

### 수정 파일

- **`engine/app/schemas.py`**: `QuestionsRequest`에 `targetRole: str | None = Field(None, max_length=100)` 추가. `ResumeFeedbackRequest.targetRole` `str | None = Field(None)` optional로 변경. `TargetRoleRequest`, `TargetRoleResponse`, `AnalyzeResponse` 신규 추가.

- **`engine/app/routers/resume.py`**: `/parse`·`/analyze` 공통 검증 로직을 `_validate_and_parse_pdf()` 헬퍼로 추출(DRY). `/analyze`, `/target-role` 엔드포인트 신규 추가. `/questions` 핸들러에 `target_role=body.targetRole` 전달.

- **`engine/app/services/llm_service.py`**: `OpenAI` 직접 호출 제거 → `call_llm()` 사용으로 통일. `generate_questions(target_role=None)` 파라미터 추가, 전달 시 프롬프트 postfix 주입.

- **`engine/app/services/feedback_service.py`**: `generate_resume_feedback(resume_text, target_role: str | None = None)` 시그니처 변경. `targetRole` 빈값·None → `"미지정 직무"` 자동 처리.

- **`engine/tests/integration/test_resume_questions_route.py`**: `test_200_with_target_role`, `test_400_target_role_too_long` 2개 추가. mock 경로 `app.services.llm_client.OpenAI`로 일괄 수정.

- **`engine/tests/integration/test_resume_feedback_router.py`**: targetRole optional 테스트 추가, 중복 테스트 2개 제거.

- **`engine/tests/unit/services/test_llm_service.py`**: `test_generate_questions_with_target_role_injects_prompt`, `test_generate_questions_without_target_role_no_injection` 2개 추가. mock 경로 수정.

- **`engine/tests/unit/services/test_feedback_service.py`**: 테스트 번호 순서 수정 (16→11, 17→12, 11→13 등).

- **`.ai.md` 4개**: `engine/.ai.md`, `services/.ai.md`, `routers/.ai.md`, `prompts/.ai.md` 모두 신규 엔드포인트·시그니처 반영.

### 기술적 결정

- `/analyze`는 PDF 파싱 + LLM 직무 추출을 단일 엔드포인트에서 처리. 프론트엔드가 한 번의 호출로 resumeText와 targetRole을 동시에 받을 수 있게 설계.
- `targetRole` 추론 실패 시 에러 대신 `"미지정"` 반환 — 프론트엔드 흐름을 막지 않고 사용자 수동 입력으로 유도.
- `extract_target_role` 반환값 `[:100]` 트런케이션 — Pydantic max_length 제약과 LLM 출력 길이 불일치로 인한 500 오류 방지.
- `llm_service.py`를 `call_llm()` 기반으로 리팩토링하여 `OPENROUTER_BASE_URL` 상수 중복 제거 및 에러 처리 일원화.
