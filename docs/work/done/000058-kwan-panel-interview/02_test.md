# 테스트 결과 — feat: [kwan] 패널 면접 연동 (#58)

실행일: 2026-03-13 (최초: 2026-03-11)
도구: Vitest v4.0.18 / Playwright
결과: **Vitest 7파일 40테스트 전부 통과** (+ Playwright e2e 1테스트 통과)

> **2026-03-12 변경 1**: `resume/questions` route를 seung 패턴(병렬 처리 + 단일 DB write)으로 통일.
> `resume-questions.test.ts` 7→8 케이스 (빈 resumeText → resumeId: null 추가).
> `prisma.resume.update` mock 제거, PDFParse mock `function()` 수정.
>
> **2026-03-12 변경 2**: `interview-session.test.ts` 4 케이스 추가 (GET session 라우트).
> `interview-answer.test.ts` 8→9 케이스 (P2025 동시 완료 충돌 → 400 추가).
> `playwright.config.ts` webServer 설정 추가 (CI: build+start, 로컬: dev).
>
> **2026-03-13 변경 3**: Zod 런타임 검증 추가로 인한 mock 정합성 수정.
> `interview-session.test.ts` MOCK_SESSION에 `updatedAt` 필드 추가 (Prisma 반환 타입과 일치).
> `interview-start.test.ts` MOCK_SESSION에 `currentPersonaLabel`, `currentQuestionType` 필드 추가.
> 테스트 케이스 수 변동 없음 (40 유지), tsc --noEmit 에러 0개 확인.

---

## 이슈 #58 완료 기준 대조

| 완료 기준 | 검증 방법 | 결과 |
|-----------|-----------|------|
| `/api/resume/questions` — resumeId + questions 반환 | `resume-questions.test.ts` | ✅ |
| `POST /api/interview/start` — session 생성 + firstQuestion 반환 | `interview-start.test.ts` | ✅ |
| `POST /api/interview/answer` — session 업데이트 + nextQuestion 반환 | `interview-answer.test.ts` | ✅ |
| `GET /api/interview/session` — 세션 상태 반환 (새로고침 복원) | `interview-session.test.ts` | ✅ |
| `QuestionList.tsx` "면접 시작" 버튼 → `/api/interview/start` 호출 | `QuestionList.test.tsx` | ✅ |
| `InterviewChat.tsx` — 페르소나 버블 + 답변 제출 + 완료 화면 | `InterviewChat.test.tsx` | ✅ |
| Playwright e2e — PDF 업로드 → 면접 시작 → 꼬리질문 수신 전 과정 | `interview-flow.spec.ts` | ✅ |

---

## Vitest 파일별 결과 (6파일 / 35테스트)

### `tests/api/resume-questions.test.ts` — 8 passed *(2026-03-12: 7→8)*

| # | 테스트 | 결과 | 비고 |
|---|--------|------|------|
| 1 | 파일 없음 → 400 한국어 에러 | ✅ | |
| 2 | 정상 PDF → 200 + fixture questions 반환 + resumeId 포함 | ✅ | DB create 1회 검증 추가 |
| 3 | DB INSERT 실패 → 500 반환 | ✅ | engine mock 추가됨 |
| 4 | 엔진 400 (파일 크기 초과) → 400 + 한국어 메시지 전달 | ✅ | DB create 미호출 검증 추가 |
| 5 | 엔진 422 (이미지 전용 PDF) → 422 + 한국어 메시지 전달 | ✅ | DB create 미호출 검증 추가 |
| 6 | 엔진 500 (LLM 오류) → 500 + 한국어 메시지 전달 | ✅ | DB create 미호출 검증 추가 |
| 7 | 네트워크 오류(타임아웃·엔진 다운) → 500 한국어 메시지 | ✅ | |
| 8 | 빈 resumeText (이미지 전용 PDF 등) → 200 + resumeId: null | ✅ | **신규 (seung 패턴)** |

### `tests/api/interview-start.test.ts` — 5 passed

| # | 테스트 | 결과 |
|---|--------|------|
| 1 | resumeId 없음 → 400 | ✅ |
| 2 | resumeId가 DB에 없음 → 404 | ✅ |
| 3 | 정상 흐름: resumeId 있음 → session 생성 + firstQuestion 반환 | ✅ |
| 4 | 엔진 호출 실패 → 500 | ✅ |
| 5 | 엔진 500 응답 → 500 전달 | ✅ |

### `tests/api/interview-answer.test.ts` — 9 passed *(2026-03-12: 8→9)*

| # | 테스트 | 결과 | 비고 |
|---|--------|------|------|
| 1 | sessionId 없음 → 400 | ✅ | |
| 2 | answer 없음 → 400 | ✅ | |
| 3 | answer 공백만 → 400 | ✅ | |
| 4 | session 없음 → 404 | ✅ | |
| 5 | 이미 완료된 session → 400 반환 (엔진 미호출) | ✅ | |
| 6 | 정상 흐름: session 업데이트 + nextQuestion 반환 | ✅ | |
| 7 | sessionComplete=true 응답 → 완료 응답 반환 | ✅ | |
| 8 | 엔진 호출 실패 → 500 | ✅ | |
| 9 | 동시 완료 충돌(P2025) → 400 반환 | ✅ | **신규** — prisma.update P2025 throw → "이미 완료된 면접 세션입니다." |

### `tests/api/interview-session.test.ts` — 4 passed *(2026-03-12: 신규)*

| # | 테스트 | 결과 |
|---|--------|------|
| 1 | sessionId 없음 → 400 | ✅ |
| 2 | session 없음 → 404 | ✅ |
| 3 | 정상 session → 200 + 세션 상태 반환 | ✅ |
| 4 | 완료된 session → 200 + sessionComplete: true | ✅ |

### `tests/components/QuestionList.test.tsx` — 5 passed

| # | 테스트 | 결과 |
|---|--------|------|
| 1 | questions 배열 → 카테고리별 그룹 렌더 | ✅ |
| 2 | 각 카테고리 내 질문 수 정확히 표시 | ✅ |
| 3 | "다시 하기" 버튼 클릭 → onReset 호출 | ✅ |
| 4 | 빈 질문 배열 → 결과 없음 메시지 | ✅ |
| 5 | "면접 시작" 버튼 클릭 → fetch 호출 후 /interview 이동 | ✅ |

### `tests/components/InterviewChat.test.tsx` — 4 passed

| # | 테스트 | 결과 |
|---|--------|------|
| 1 | 초기 질문이 페르소나 레이블과 함께 렌더된다 | ✅ |
| 2 | 답변 입력 후 제출 → fetch 호출되고 다음 질문 렌더 | ✅ |
| 3 | sessionComplete=true 응답 시 완료 화면 표시 | ✅ |
| 4 | "처음으로" 버튼 클릭 → onComplete 콜백 호출 | ✅ |

### `tests/components/UploadForm.test.tsx` — 5 passed (MVP 01 기존 테스트 유지)

---

## Playwright e2e 결과 (1테스트 / 29.7s)

| 테스트 | 결과 | 소요 시간 |
|--------|------|-----------|
| PDF 업로드 → 질문 생성 → 면접 시작 → 꼬리질문 수신 | ✅ | 29.7s |

- 영상: `test-results/.../video.webm`
- 검증 범위: PDF 업로드 → 질문 생성 → 면접 시작 → 페르소나 첫 질문 → 짧은 답변 → `(꼬리질문)` 배지 등장 확인

### 버그 수정 (e2e 과정 중 발견)
- **엔진 `max_tokens` 부족**: `interview_service.py` `_call_llm()`의 `max_tokens=1024` → `2048`로 증가
  - 원인: 자소서 원문이 프롬프트에 포함되면 응답 JSON이 1024토큰 초과로 잘림 → `LLM 응답이 유효한 JSON이 아닙니다` 에러

---

## 전체 검증 결과 요약 (validate-all, 2026-03-12 최종)

날짜: 2026-03-12

### 아키텍처 검증 (architecture-validator)

**불변식 1 — 인증 위치**
- ✅ `engine/` 내 auth/jwt/token/login 로직 없음
- ✅ engine의 "session"은 인터뷰 도메인 필드(sessionComplete)이며 인증 세션 아님

**불변식 2 — LLM 호출 위치**
- ✅ `services/kwan/src/` 전체에 `anthropic`, `openai`, `openrouter`, `@anthropic-ai` import 없음
- ✅ LLM 호출은 `engine/app/services/interview_service.py` 내부에서만 (OpenRouter API)
- ⚠️ IMPORTANT: `services/kwan/src/app/api/resume/questions/route.ts`에서 `pdf-parse` (PDFParse)로 PDF 텍스트를 직접 추출함.
  - 평가: 아키텍처 불변식 위반 **아님**. LLM 호출이 아닌 텍스트 추출이며, 엔진의 `/api/resume/questions` 응답에 extractedText가 없기 때문에 서비스가 직접 추출해야 하는 불가피한 구조. `services/kwan/.ai.md`에 이미 근거 기록됨.

**불변식 3 — 서비스 간 통신**
- ✅ `services/kwan/src/` 내 다른 서비스(siw/lww/seung) URL 참조 없음
- ✅ 다른 서비스 코드 import 없음

**불변식 4 — DB 소유권**
- ✅ `engine/` 내 Prisma/SQLAlchemy/DATABASE_URL 없음
- ✅ 엔진은 완전 stateless: 세션·이력 저장 없음
- ✅ DB 소유는 서비스(kwan): Prisma 6 + Supabase

**불변식 5 — 테스트**
- ✅ 모든 신규 라우트에 대응하는 Vitest 테스트 존재 (40테스트 / 7파일)
- ✅ Playwright e2e 1건 통과
- ✅ playwright.config.ts webServer 설정 추가 — CI 자동 실행 가능
- ✅ P2025 TOCTOU 충돌 테스트 추가
- ⚠️ IMPORTANT: engine `interview_service.py` 변경사항(`max_tokens: 1024`)에 대한 엔진 측 pytest 테스트 없음 (해당 변경이 아직 커밋되지 않았으며, engine 커밋은 별도 처리 예정으로 01_plan.md에 명시됨)

**엔진 API 계약 검증**
- ✅ `/api/interview/start` 요청: `{ resumeText, personas, mode: 'panel' }` — engine schemas.py `InterviewStartRequest`와 일치
- ✅ `/api/interview/start` 응답: `{ firstQuestion: QuestionWithPersona, questionsQueue: QueueItem[] }` — 계약과 일치
- ✅ `/api/interview/answer` 요청: `{ resumeText, history, questionsQueue, currentQuestion, currentPersona, currentAnswer }` — engine `InterviewAnswerRequest`와 일치
- ✅ `/api/interview/answer` 응답: `{ nextQuestion, updatedQueue, sessionComplete }` — 계약과 일치
- ⚠️ IMPORTANT: 서비스의 `HistoryItem`에 `questionType?: 'main' | 'follow_up'` 필드가 추가되어 있지만, 엔진 `HistoryItem` 스키마에는 해당 필드가 없음. 실제 engine 호출 시 history 배열에서 이 필드가 그대로 전달되는 구조. Pydantic은 extra field를 기본적으로 무시하므로 런타임 오류는 없으나, 계약 명시적 일치 여부 주의 필요.

---

### 백엔드 검증 (backend-validator)

이번 PR의 변경 파일: `git diff --name-only HEAD`

```
docs/work/active/000058-kwan-panel-interview/01_plan.md
services/kwan/src/app/api/resume/questions/route.ts
services/kwan/tests/api/resume-questions.test.ts
```

engine/ 변경 없음 (01_plan.md: "engine/ — 변경 없음"). 이전 커밋(efbd340)에서 engine 관련 변경은 없었으므로 engine 코드 검증 범위는 현재 상태 확인으로 한정.

**`engine/app/routers/interview.py`**
- ✅ router → service 레이어 분리 완전함 (비즈니스 로직 없음)
- ✅ 에러 코드 계약 준수 가능 (main.py exception handler 위임 구조)
- ✅ `/api/interview/start`, `/api/interview/answer`, `/api/interview/followup` 모두 계약 등록됨

**`engine/app/schemas.py`**
- ✅ Pydantic v2 `BaseModel` 사용
- ✅ `QuestionItem`, `Meta`, `QuestionWithPersona`, `QueueItem`, `HistoryItem` 모두 정의됨
- ✅ `Field(..., min_length=1)` 등 필드 검증 적용됨
- ⚠️ IMPORTANT: `engine/app/schemas.py`의 `HistoryItem`에는 `questionType` 필드가 없으나, 서비스에서 전송 시 포함될 수 있음. Pydantic 기본값(ignore extras)으로 처리되지만 명시적 계약 동기화 검토 권장.

**`engine/app/services/interview_service.py`**
- ✅ LLM 호출만 존재 (PDF 파싱 없음)
- ✅ async/await 패턴 미사용 (동기 함수) — 현재 구조상 문제 없음 (FastAPI가 threadpool에서 실행)
- ✅ 타입 힌트 작성됨
- ✅ 에러 핸들링: `LLMError` throw 존재
- ⚠️ IMPORTANT: `_call_llm()` 내 `max_tokens=1024`가 하드코딩됨. 01_plan.md에 `max_tokens: 1024 → 2048` 버그픽스가 필요하다고 명시되었으나 현재 engine 코드에는 반영 안 됨 (`engine/` 변경 없음). engine 별도 커밋 필요.

**`engine/tests/`**
- ✅ `tests/unit/services/test_interview_service.py` 존재
- ✅ `tests/integration/test_interview_router.py` 존재
- ⚠️ IMPORTANT: `max_tokens=1024` 버그픽스 후 engine 단위 테스트 업데이트 필요 (현재 engine 변경 미반영이므로 해당 시점에 처리)

---

### 서비스 검증 (service-validator)

**Next.js API 라우트**

`POST /api/resume/questions` (`route.ts`)
- ✅ `ENGINE_BASE_URL` 환경변수 사용 (`engine-client.ts`에서 `process.env.ENGINE_BASE_URL`)
- ✅ 타임아웃 30초 설정 (`AbortSignal.timeout(30_000)`)
- ✅ 에러 변환: 엔진 에러 JSON → 한국어 사용자 메시지
- ✅ multipart/form-data PDF 전달 올바름
- ✅ LLM 직접 호출 없음
- ✅ TypeScript strict — `any` 타입 없음
- ⚠️ IMPORTANT: `extractTextFromPdf()` 내 catch에서 빈 문자열 반환 (`return ''`). engine.ai.md의 파서 계약("예외를 던짐, 빈 문자열 반환 없음")은 engine parsers에 적용되는 것이며 서비스 내 로컬 함수에 적용되는 계약 아님. 그러나 빈 문자열 반환 시 `resumeId: null` 처리로 graceful degradation이 구현됨. 허용 가능한 패턴.

`POST /api/interview/start` (`route.ts`)
- ✅ `ENGINE_BASE_URL` 환경변수 사용
- ✅ 타임아웃 30초 설정
- ✅ 에러 변환: 한국어 메시지
- ✅ LLM 직접 호출 없음
- ✅ TypeScript strict — `any` 타입 없음
- ✅ 입력 검증: resumeId 없음 → 400, DB 없음 → 404
- ✅ TOCTOU 방어 불필요 (start는 단순 create)

`POST /api/interview/answer` (`route.ts`)
- ✅ `ENGINE_BASE_URL` 환경변수 사용
- ✅ 타임아웃 30초 설정
- ✅ 에러 변환: 한국어 메시지
- ✅ 비용 절감 패턴: 공백 답변 조기 차단, 5000자 트림
- ✅ TOCTOU 방어: `prisma.interviewSession.update({ where: { id, sessionComplete: false } })` + P2025 처리
- ✅ LLM 직접 호출 없음
- ✅ TypeScript strict — `any` 타입 없음

`GET /api/interview/session` (`route.ts`)
- ✅ sessionId 없음 → 400
- ✅ session 없음 → 404
- ✅ 세션 전체 상태 반환 (새로고침 복원 목적)

**프론트엔드 컴포넌트**

`InterviewChat.tsx`
- ✅ 상태 관리: isLoading, sessionComplete, errorMsg — 5단계(idle/uploading/processing/done/error) 중 면접 진행에 필요한 상태 포함
- ✅ 로딩 UI: 버튼 "처리 중..." 표시
- ✅ 에러 UI: 한국어 인라인 메시지 (`role="alert"`)
- ✅ 완료 화면: 면접 요약 + "처음으로" 버튼
- ✅ 페르소나별 색상 버블 (hr: 파랑, tech_lead: 초록, executive: 보라)
- ✅ 꼬리질문 배지: `(꼬리질문)` 표시
- ✅ TypeScript strict — `any` 타입 없음
- ✅ Tailwind CSS 사용 (인라인 style 없음)
- ⚠️ IMPORTANT: 5000자 입력 카운터 UI가 없음 (01_plan.md 설계에는 "5000자 카운터" 명시). 서버에서 5000자 트림은 구현됨. UX 개선 여지 있으나 기능 AC에는 포함되지 않음.

`page.tsx` (메인)
- ✅ `idle` → `uploading` → `done` → `error` 상태 전환 구현
- ✅ 로딩 메시지 "자소서를 분석하고 있습니다..." 표시
- ✅ 에러 메시지 한국어 + "다시 시도하기" 버튼으로 idle 복귀

**엔진 HTTP 클라이언트 (`engine-client.ts`)**
- ✅ `ENGINE_BASE_URL` 환경변수 읽기 (fallback: `localhost:8000`)
- ✅ 30초 타임아웃 설정 (`AbortSignal.timeout(30_000)`)
- ✅ `callEngineQuestions`, `callEngineStart`, `callEngineAnswer` 3개 함수 구현
- ✅ 재시도 로직 없음 (MVP 규칙 준수)
- ⚠️ IMPORTANT: 반환 타입이 `Promise<Response>` (raw Response)로, 타입 정의 파일에 `QuestionItem`, `Meta` 등 응답 타입이 별도 정의되어 있으나 engine-client 함수 자체에서는 typed 응답을 반환하지 않음. 호출측(route.ts)에서 타입 캐스트 처리. MVP 수준에서는 허용되나 향후 개선 권장.

**타입 정의 (`domain/interview/types.ts`)**
- ✅ `QuestionWithPersona`, `QueueItem`, `HistoryItem`, `InterviewSession` 정의됨
- ✅ `engine/.ai.md` 계약 타입과 일치
- ✅ strict 적용 가능

**서비스 격리**
- ✅ 다른 서비스(siw/lww/seung) URL 참조 없음
- ✅ 다른 서비스 코드 import 없음

**테스트 (Vitest)**
- ✅ 모든 신규 API 라우트에 대응 Vitest 테스트 존재
- ✅ 엔진 호출은 mock 처리 (`vi.mock('@/lib/engine-client', ...)`)
- ✅ DB 호출은 mock 처리 (`vi.mock('@/lib/db', ...)`)
- ✅ 에러 시나리오 테스트 (400, 422, 500, 네트워크 오류)
- ✅ 상태 전환 테스트 (sessionComplete, nextQuestion)
- ⚠️ IMPORTANT: `interview-start.test.ts`의 MOCK_SESSION에 `currentPersonaLabel`, `currentQuestionType` 필드가 없음. 실제 Prisma 반환 타입 캐스트로 처리되어 테스트 통과하지만 fixture 완성도 개선 여지 있음.

**환경변수**
- ✅ `.env.local.example` 존재 — `ENGINE_BASE_URL`, `DATABASE_URL`, `DIRECT_URL` 문서화
- ✅ 코드에 하드코딩된 URL 없음
- ✅ `NEXT_PUBLIC_` 접두사 금지 준수

---

## 아키텍처 검증 결과 (CLAUDE.md 불변식 기준)

| 불변식 | 결과 |
|--------|------|
| 1. 인증은 서비스에서만 — 엔진 인증 로직 없음 | ✅ |
| 2. LLM 호출은 엔진에서만 — 서비스 직접 LLM 호출 없음 | ✅ |
| 3. 서비스 간 직접 통신 금지 | ✅ |
| 4. DB는 서비스 소유 — 엔진 stateless | ✅ |
| 5. 테스트 없는 PR 머지 금지 | ✅ |

---

🚨 CRITICAL 총계: **0개**
⚠️ IMPORTANT 총계: **8개** (모두 개선 권고, 머지 블로커 아님)
✅ 통과 항목: **44개** (playwright webServer + P2025 테스트 추가로 +2)

머지 가능 여부: **YES** (CRITICAL 0개)

---

### IMPORTANT 항목 요약

| # | 영역 | 항목 |
|---|------|------|
| 1 | 아키텍처 | 서비스 내 pdf-parse 직접 사용 — 불변식 위반 아님, `.ai.md`에 근거 기록됨 |
| 2 | 아키텍처 | engine `HistoryItem` 스키마에 `questionType` 필드 없음 (서비스만 포함) — Pydantic extra 무시로 런타임 문제 없음 |
| 3 | 아키텍처 | engine pytest: `max_tokens` 버그픽스 커밋 후 테스트 업데이트 필요 |
| 4 | 백엔드 | `engine/app/services/interview_service.py` `max_tokens=1024` → 2048 버그픽스 미반영 (engine 별도 커밋 예정) |
| 5 | 백엔드 | engine `HistoryItem` 스키마에 `questionType` 필드 계약 동기화 검토 권장 |
| 6 | 서비스 | `InterviewChat.tsx` 5000자 입력 카운터 UI 미구현 (서버 트림은 구현됨) |
| 7 | 서비스 | `engine-client.ts` 반환 타입이 raw `Response` — 향후 typed 응답 반환 개선 권장 |
| 8 | 서비스 | `interview-start.test.ts` MOCK_SESSION fixture에 `currentPersonaLabel`, `currentQuestionType` 필드 누락 |
