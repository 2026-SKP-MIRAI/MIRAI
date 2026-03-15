# feat: [engine] 기능 02 — 이력서·자소서 피드백 및 강점·약점 분석 엔진 구현 (POST /api/resume/feedback)

## 사용자 관점 목표
면접 준비 전 자소서를 5개 항목으로 진단받아 면접관 시각에서 강점·약점과 구체적 개선 방향을 확인한다.

## 배경
dev_spec.md 기능 02 (Phase 3). 기능 01(질문 생성)·03(패널 면접)과 독립적으로 `resumeText`를 소비하며 논리적 충돌 없음. `llm_client.py` 인프라 완비 상태이므로 선행 구현 가능.

## 완료 기준
- [x] `POST /api/resume/feedback` — `{ resumeText, targetRole }` 입력 시 200 반환
- [x] `scores` 5개 항목 (specificity, achievementClarity, logicStructure, roleAlignment, differentiation) 각 0~100 정수, clamp 보정 포함
- [x] `strengths` 2~3개 · `weaknesses` 2~3개 · `suggestions` 배열 반환 (각 항목: `{ section, issue, suggestion }`)
- [x] `resumeText`/`targetRole` 누락·빈값 → 400, LLM 오류 → 500
- [x] `engine/.ai.md`에 `/api/resume/feedback` 엔드포인트 계약 추가
- [x] `engine/app/services/.ai.md`, `routers/.ai.md`, `prompts/.ai.md` 최신화
- [x] 단위 테스트 12개 이상 + 통합 테스트 8개 이상 모두 통과
- [x] 불변식 위반 없음 (LLM 호출은 `services/`에서만, engine stateless 유지)

## 구현 플랜
1. `schemas.py` — `FeedbackRequest`(resumeText, targetRole), `FeedbackResponse`, `FeedbackScores`, `SuggestionItem`(section, issue, suggestion) 추가
2. `prompts/feedback_v1.md` — 역할·5개 항목·`{resume_text}` `{target_role}` 플레이스홀더·JSON 출력 규칙 작성
3. `services/feedback_service.py` — `_clamp`, `_build_prompt(resume_text, target_role)`, `_parse_feedback`, `generate_feedback` 구현 (`llm_client.py` 사용, `report_service.py` 패턴 동일)
4. `routers/resume.py` — `/feedback` 엔드포인트 추가
5. `engine/.ai.md` · `services/.ai.md` · `routers/.ai.md` · `prompts/.ai.md` 업데이트 + 테스트 작성 (`tests/fixtures/output/mock_feedback_response.json` 포함)

## 개발 체크리스트
- [x] 테스트 코드 포함
- [x] 해당 디렉토리 `.ai.md` 최신화
- [x] 불변식 위반 없음

---

## 작업 내역

### 신규 파일 (4개)

- **`engine/app/services/feedback_service.py`** — 이력서 피드백 핵심 로직. `_clamp()`로 0-100 범위 강제, `_build_prompt()`로 resume_feedback_v1.md 템플릿에 자소서·직무 삽입, `_parse_feedback()`으로 LLM JSON 응답을 방어적으로 파싱(score fallback 50, strengths/weaknesses 2개 최소 보장), `generate_resume_feedback()`이 진입점. `report_service.py` / `practice_service.py` 패턴 동일하게 적용.

- **`engine/app/prompts/resume_feedback_v1.md`** — 채용 전문 서류 컨설턴트 역할 지시문. 5개 진단 항목(specificity, achievementClarity, logicStructure, roleAlignment, differentiation) 정의 + JSON only 출력 규칙. 플레이스홀더 `{resume_text}`, `{target_role}`.

- **`engine/tests/unit/services/test_feedback_service.py`** — 서비스 단위 테스트 12개. clamp 경계값, truncation, fallback, LLMError/ResumeFeedbackParseError 전파까지 커버.

- **`engine/tests/integration/test_resume_feedback_router.py`** — 라우터 통합 테스트 8개. 200(필드·scores), 400(누락·빈값 4케이스), 500(LLM 오류·JSON 파싱 오류). inline mock 방식 사용(fixture 파일 불필요).

### 수정 파일 (7개)

- **`engine/app/parsers/exceptions.py`** — `ResumeFeedbackParseError(LLMError)` 추가. main.py의 기존 `handle_500` 핸들러가 자동 포착하므로 main.py 수정 불필요.

- **`engine/app/schemas.py`** — 4개 스키마 추가. `ResumeFeedbackScores`(5필드 ge=0 le=100), `SuggestionItem`(section·issue·suggestion), `ResumeFeedbackRequest`(min_length=1), `ResumeFeedbackResponse`(strengths/weaknesses min_length=2 max_length=3).

- **`engine/app/routers/resume.py`** — `POST /feedback` 엔드포인트 추가. 기존 `/questions`와 같은 라우터(prefix="/resume")에 추가해 main.py 수정 불필요.

- **`engine/.ai.md`** — 예외 계층에 `ResumeFeedbackParseError` 추가, `/api/resume/feedback` 엔드포인트 계약 추가.

- **`engine/app/services/.ai.md`** — `feedback_service.py` 항목 및 `generate_resume_feedback()` 시그니처 추가.

- **`engine/app/routers/.ai.md`** — `resume.py` 설명에 `/feedback` 추가.

- **`engine/app/prompts/.ai.md`** — 파일 목록 및 버전 이력 테이블에 `resume_feedback_v1.md` 추가.

### 기술적 결정

- **inline mock 방식 채택**: `fixtures/output/` JSON 파일이 현재 미커밋 상태이므로 통합 테스트에서 파일 의존 없이 inline JSON 사용.
- **strengths/weaknesses Pydantic min_length=2**: LLM이 1개 이하 반환 시 Pydantic 오류 방지를 위해 서비스 레이어에서 `_safe_list()`로 2개 보장 후 응답 모델에 전달.

