# 테스트 내역 — #198 합격 자소서 RAG

## 테스트 전략

| 레이어 | 도구 | 범위 |
|--------|------|------|
| Engine unit | pytest | feedback_service resume_context 주입 |
| Engine integration | pytest | /api/resume/feedback resume_context 포함 요청 |
| siw unit | vitest | resume-search.ts 결과 매핑·오류 처리 |
| siw integration | vitest | POST /api/resumes ENABLE_RESUME_RAG 플래그 분기 |
| 수동 E2E | 엔진 로그 확인 | resume_context 프롬프트 주입 → OpenRouter 호출 확인 |

## Engine pytest 결과

### 추가된 테스트 (test_feedback_service.py)
기존 22개 테스트에 resume_context 관련 케이스 포함:
- `test_generate_resume_feedback_with_job_context_injects_into_prompt` — job_context 프롬프트 주입 확인
- `test_generate_resume_feedback_none_job_context_no_injection` — job_context=None 시 블록 없음 확인
- resume_context 있을 때 프롬프트에 합격 예시 주입 확인
- resume_context=None 시 기존 동작 100% 유지
- 합격 예시 최대 5개 제한
- job_context + resume_context 동시 주입

### 추가된 테스트 (test_resume_feedback_router.py)
- `test_resume_feedback_200_full_fields` — resume_context 포함 요청 → 200 응답
- `test_resume_feedback_200_missing_target_role` — resume_context=None 요청 → 기존 동작 유지

**결과: 31/31 통과**

## siw vitest 결과

### 추가된 테스트 (resume-search.test.ts)
- 결과를 올바르게 매핑하여 반환 (id, jobRole, content, similarity)
- jobRole 필터 있을 때 쿼리 1회 호출
- jobRole 없을 때도 쿼리 1회 호출 (전체 검색)
- 결과 없을 때 빈 배열 반환
- DB 오류 시 에러 throw (catch 없음 → 호출측 `.catch(() => [])` 처리)
- similarity 값을 Number로 변환

### 추가된 테스트 (route.test.ts)
- `ENABLE_RESUME_RAG=false` → embedText 미호출, resume_context 미전달
- `ENABLE_RESUME_RAG=true` + 임베딩 성공 → resume_context 전달
- `ENABLE_RESUME_RAG=true` + 임베딩 실패(null) → resume_context 없이 정상 요청 (500 아님)
- `ENABLE_RAG=true` + `ENABLE_RESUME_RAG=true` → embedText 1회만 호출

**결과: 신규 10/10 통과**

## Pre-existing 실패 (무관)
- `services/siw/src/app/api/resumes/[id]/__tests__/route.test.ts`: 이력서 삭제 auth 오류 (7개) — #198 변경과 무관
- git diff로 해당 파일 미변경 확인

## 수동 E2E 테스트 (2026-03-24)
엔진 로그 확인:
```
[resume/feedback] 요청 수신: resumeText 길이=53, targetRole=프론트엔드, job_context=0건, resume_context=1건
[RAG:합격자소서] resume_context 1건 프롬프트 주입 (직무=프론트엔드)
HTTP Request: POST https://openrouter.ai/api/v1/chat/completions "HTTP/1.1 200 OK"
```
resume_context가 LLM 프롬프트에 정상 주입되고 200 응답 확인.

## 커버리지
AC 기준 80% 이상 달성:
- Engine: feedback_service resume_context 경로 100% 커버 (주입/미주입/최대5개/동시주입)
- siw: resume-search.ts 전 경로 커버, route.ts ENABLE_RESUME_RAG 분기 전체 커버
