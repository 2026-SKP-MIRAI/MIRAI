# feat: [seung] Phase 1 — 패널 면접 + 꼬리질문 서비스 연동 (engine #40 e2e)

## 사용자 관점 목표
seung 서비스에서 자소서 업로드 후 3인 패널 면접 세션을 챗봇 형식으로 진행하고, 답변 품질에 따라 꼬리질문(CLARIFY·CHALLENGE·EXPLORE)을 받을 수 있다.

## 배경
engine #40(기능 03·04 — 패널 면접 세션 + 꼬리질문)이 완료됐으며, seung Next.js 서비스가 이를 연동한다. MVP 01(자소서 → 질문 생성)은 완료 상태. 엔진은 완전 stateless — 세션 상태(`resumeText`, `history`, `questionsQueue`)는 seung이 Supabase에서 관리하고, 엔진 호출 시 풀 컨텍스트를 전달한다.

엔진 `QuestionsResponse`에 `resumeText`가 포함되지 않으므로, 질문 생성 시 PDF 원문 텍스트를 서비스에서 추출해 Supabase `resumes` 테이블에 별도 저장한다.

**엔진 수정 금지** — 엔진 API 규격(`engine/.ai.md`)에 맞게 서비스 파트만 개발한다.

## 사전 검토 필수
- `engine/.ai.md` — 엔진 API 계약, Interview 스키마 필드 확인
- `docs/specs/mirai/dev_spec.md` — 기능 03·04 명세

## 완료 기준
- [x] Supabase + Prisma 초기화: `resumes` (resumeText, questions), `interview_sessions` (resumeId FK, questionsQueue, history, sessionComplete) 테이블 + RLS
- [x] `/api/resume/questions` 라우트 수정: PDF 텍스트 추출 → Supabase `resumes` 저장 → `resumeId` 반환
- [x] `POST /api/interview/start` — Supabase `resumes`에서 resumeText 조회 → engine 호출 → session 생성
- [x] `POST /api/interview/answer` — Supabase session 조회 → engine 호출 → session 업데이트 → nextQuestion 반환
- [x] 면접 세션 UI (`/interview?sessionId=xxx`) — 챗봇 형식: 페르소나별 질문·답변 버블, 꼬리질문 흐름, 세션 완료 화면
- [x] `/resume` 완료 화면에 "면접 시작" 버튼 → `/interview?sessionId=xxx` 이동
- [x] Playwright e2e: 자소서 업로드 → 면접 시작 → 답변 → 꼬리질문 수신 전 과정

## 구현 플랜
1. **Supabase + Prisma 설치·초기화** — `prisma`, `@prisma/client`, `pdf-parse` 설치, 테이블 마이그레이션
2. **기존 라우트 수정** — `/api/resume/questions/route.ts`: PDF 텍스트 추출 → `resumes` 저장 → `resumeId` 반환
3. **API 라우트 TDD**:
   - `app/api/interview/start/route.ts` — Supabase `resumes` 조회 → engine 프록시 → session 생성
   - `app/api/interview/answer/route.ts` — Supabase session 조회 → engine 프록시 → session 업데이트
4. **UI 컴포넌트** — `InterviewChat.tsx` (페르소나 버블), `AnswerInput.tsx`
5. **페이지** — `app/interview/page.tsx` + `/resume` 완료 화면 버튼 추가
6. **Playwright e2e** — 실제 엔진 연동 real-interview-flow 테스트

## 개발 체크리스트
- [x] 테스트 코드 포함 (Vitest unit 41개 + Playwright e2e 9개 + 실제 연동 2개, 총 52개)
- [x] 해당 디렉토리 `.ai.md` 최신화
- [x] 불변식 위반 없음 (LLM 직접 호출 금지 — 엔진 경유만)
- [x] `SUPABASE_SERVICE_ROLE_KEY` 서버 전용 (`NEXT_PUBLIC_` 금지)

---

## 작업 내역

### 구현 개요
`services/seung/`에 Supabase + Prisma 기반 패널 면접 세션 관리 시스템을 구현했다. 엔진은 완전 stateless이므로 세션 상태(resumeText, history, questionsQueue)를 서비스가 Supabase에서 관리하고 매 호출 시 풀 컨텍스트를 전달한다.

### 주요 변경 파일

**`prisma/schema.prisma`** — Resume, InterviewSession 모델. Supabase PostgreSQL에 마이그레이션 완료.

**`src/lib/prisma.ts`** — PrismaClient 싱글턴 (cold start 방지).

**`src/lib/pdf-utils.ts`** — pdf-parse로 서버사이드 PDF 텍스트 추출. 실패 시 '' 반환 (best-effort).

**`src/app/api/resume/questions/route.ts`** — engine 호출 + PDF 추출 병렬 실행. Prisma로 resumes 저장 후 resumeId 반환.

**`src/app/api/interview/start/route.ts`** — resumeText Supabase 조회 → engine /interview/start 호출 → interview_sessions 생성 → sessionId 반환.

**`src/app/api/interview/answer/route.ts`** — session + resume 조회 → engine /interview/answer 호출 → history·queue·sessionComplete DB 업데이트 → nextQuestion 반환.

**`src/app/api/interview/session/route.ts`** — GET: 면접 페이지 초기 로딩용 세션 상태 조회.

**`src/components/InterviewChat.tsx`** — 페르소나별 색상 버블(HR:파랑/기술팀장:초록/경영진:보라), 꼬리질문 배지, 완료 화면.

**`src/components/AnswerInput.tsx`** — textarea, 5000자 카운터, 제출 버튼.

**`src/app/interview/page.tsx`** — sessionId 없으면 /resume redirect. 세션 로드 → 채팅 UI → 답변 제출 → 다음 질문 렌더.

**`src/app/resume/page.tsx`** — 질문 생성 완료 후 "면접 시작" 버튼 추가. /interview?sessionId=xxx 라우팅.

**`tests/e2e/real-interview-flow.spec.ts`** — 실제 엔진 + Supabase 연동 E2E (24.8s, 영상 녹화).

### 검증 단계 버그 수정 (2026-03-10)

코드 검증 중 발견된 3건 수정:

1. **페이지 새로고침 시 꼬리질문 type 손실** — `InterviewSession`에 `currentQuestionType` 컬럼 추가 (`prisma migrate add-question-type`). `interview/answer/route.ts`에서 history 저장 시 `questionType` 포함, 엔진 전송 시 strip. `interview/page.tsx`에서 하드코딩 `'main'` → 실제 DB 값 사용.

2. **`engine/.ai.md` 문서 누락** — `/api/interview/answer` 입력 계약에 `currentQuestion`, `currentPersona` 2개 필드 추가 (실제 엔진 코드는 항상 정상이었으나 문서 불일치).

3. **E2E mock `resumeId` 누락** — `upload-flow.spec.ts`의 `MOCK_SUCCESS_RESPONSE`에 `resumeId` 추가. `interview-flow.spec.ts`의 `MOCK_SESSION_RESPONSE`에 `currentQuestionType` 추가.

### 코드 리뷰 반영 (2026-03-11)

시니어 리뷰(5건) + 자체 코드 리뷰(10건) 전체 반영:

**HIGH**
- `interviewMode: 'practice'` 타입 제거 — Phase 3 미구현 제약 위반. `types.ts`와 `start/route.ts` body 타입에서 삭제.
- TOCTOU 레이스 컨디션 방어 — `answer/route.ts`의 `interviewSession.update`에 `where: { sessionComplete: false }` 추가. 동시 요청이 세션을 먼저 완료한 경우 Prisma `P2025` 에러를 잡아 400 반환.

**MEDIUM**
- 빈 답변 검증을 DB 조회 이전으로 이동 — 불필요한 DB 라운드트립 제거.
- sessionId URL 인코딩 — `new URLSearchParams({ sessionId })`로 안전한 쿼리스트링 생성.
- 더블클릭 방지 — `submittingRef`(useRef) 추가로 비동기 상태 배치 간격의 동시 제출 차단.
- `session/route.ts` select 절 추가 — 불필요한 컬럼(questionsQueue 등) 조회 제외.
- `resume/questions/route.ts` 엔진 응답 검증 — `questions`가 배열이 아니면 502 반환.

**LOW**
- React key 수정 — `InterviewChat`에서 배열 index → stable `msg.id` 사용. 버블 롤백 시 reconciliation 오류 방지.
- `start/route.ts` 미사용 `interviewMode` body 필드 제거.
- 신규 테스트 2개 추가 — 빈 문자열 답변 400, 5001자 답변 5000자 잘림 검증. **Vitest 41/41 통과.**
