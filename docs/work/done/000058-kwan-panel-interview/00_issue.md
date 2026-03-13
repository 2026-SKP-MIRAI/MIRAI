# feat: [kwan] Phase 1 — 패널 면접 + 꼬리질문 서비스 연동 (engine #40 e2e)

## 사용자 관점 목표
kwan 서비스에서 자소서 업로드 후 HR·기술팀장·경영진 3인 패널 면접 세션을 진행하고, 답변 품질에 따라 꼬리질문(CLARIFY·CHALLENGE·EXPLORE)을 받을 수 있다.

## 배경
engine #40(기능 03·04 — 패널 면접 세션 + 꼬리질문)이 완료됐으며, kwan Next.js 서비스가 이를 연동한다. MVP 01(자소서 → 질문 생성)은 완료 상태.

엔진은 완전 stateless — 세션 상태(`resumeText`, `history`, `questionsQueue`)는 kwan이 Supabase에서 관리하고, 엔진 호출 시 풀 컨텍스트를 전달한다. 엔진 `QuestionsResponse`에 `resumeText`가 포함되지 않으므로, 질문 생성 시 PDF 원문 텍스트를 서비스에서 `pdf-parse`로 추출해 Prisma `resumes` 테이블에 저장한다.

**엔진 수정 금지** — `engine/.ai.md` 규격에 맞게 서비스 파트만 개발한다.

## 사전 검토 필수
- `engine/.ai.md` — 엔진 API 계약 (`/api/interview/start`, `/api/interview/answer`)
- `docs/specs/mvp/dev_spec.md` — 기능 03·04 명세

## 완료 기준

### Supabase + Prisma 초기화
- [x] `prisma`, `@prisma/client`, `pdf-parse` 설치 (`pdfjs-dist` 대신 서버 사이드 전용 `pdf-parse` 사용)
- [x] Supabase 테이블: `resumes` (resumeText, questions), `interview_sessions` (resumeId FK, questionsQueue, history, sessionComplete) — Prisma schema + 마이그레이션
- [x] 환경변수 서버 전용 (`DATABASE_URL`, `DIRECT_URL` — `NEXT_PUBLIC_` 절대 금지)

### API 라우트 수정·추가 (TDD)
- [x] `/api/resume/questions` 수정 — `pdf-parse`로 PDF 텍스트 추출 → Prisma `resumes` 저장 → `resumeId` + questions 반환 (seung 패턴: `Promise.all` 병렬 + 단일 DB write)
- [x] `POST /api/interview/start` — Prisma `resumes`에서 resumeText 조회 → engine 호출 → `interview_sessions` 생성
- [x] `POST /api/interview/answer` — Prisma session 조회 → engine 호출 → session 업데이트 → nextQuestion 반환

### UI
- [x] `domain/interview/types.ts` 확장 — `Persona`, `QuestionWithPersona`, `QueueItem`, `HistoryItem`, `InterviewSession`, `UploadState` 정의
- [x] `QuestionList.tsx`에 "면접 시작" 버튼 → `/api/interview/start` 호출 → `/interview?sessionId=xxx` 이동
- [x] `InterviewChat.tsx` — 페르소나별 색상 버블 + `(꼬리질문)` 배지 + 답변 입력
- [x] `sessionComplete: true` 시 완료 화면 + "처음으로" 버튼

### 테스트
- [x] Vitest: `start`, `answer`, `resume-questions` 라우트 단위 테스트 (35 테스트 통과)
- [x] Vitest: `InterviewChat.tsx`, `QuestionList.tsx` 컴포넌트 테스트
- [x] Playwright e2e: 자소서 업로드 → 면접 시작 → 답변 → 꼬리질문 수신 전 과정

### 불변식·문서
- [x] `services/kwan/.ai.md` 최신화 (Prisma 스택, 신규 구조, Playwright 커맨드 추가)
- [x] LLM 직접 호출 금지 (`import anthropic` 없음 — validate-all CRITICAL 0개)
- [x] engine #40 완료 확인 후 시작 (의존성 충족)

---

## 작업 내역

### 구현 개요

Prisma 6 + Supabase PostgreSQL 기반 패널 면접 세션 관리 시스템 구현. 엔진 stateless 특성으로 인해 세션 상태 전체를 서비스가 DB에서 관리하고 매 호출 시 풀 컨텍스트를 전달하는 구조로 설계.

### 주요 신규 파일

| 파일 | 역할 |
|------|------|
| `prisma/schema.prisma` | Resume, InterviewSession 모델 (currentQuestionType 포함) |
| `src/lib/db.ts` | PrismaClient 싱글턴 (serverless cold start 방지) |
| `src/app/api/interview/start/route.ts` | resumeText 조회 → engine → session 생성 |
| `src/app/api/interview/answer/route.ts` | session 조회 → engine → history·queue 업데이트 |
| `src/app/api/interview/session/route.ts` | 세션 상태 조회 (새로고침 복원용) |
| `src/domain/interview/types.ts` | Persona, QuestionWithPersona, QueueItem, HistoryItem 등 |
| `src/components/InterviewChat.tsx` | 페르소나별 색상 버블, 꼬리질문 배지, 완료 화면 |
| `src/app/interview/page.tsx` | 채팅 UI, sessionId 없으면 / redirect |
| `e2e/interview-flow.spec.ts` | Playwright e2e |

### 주요 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/app/api/resume/questions/route.ts` | seung 패턴: `Promise.all` 병렬 처리 + 단일 DB write |
| `src/components/QuestionList.tsx` | "면접 시작" 버튼 추가 |
| `src/lib/engine-client.ts` | `callEngineStart`, `callEngineAnswer` 추가 |

### 주요 기술 결정

**`questionType` DB 저장 패턴**
DB에는 `questionType`(`main`/`follow_up`)을 저장하고 engine 전송 시 strip. 새로고침 시 꼬리질문 type 복원과 engine 계약 준수를 동시에 달성.

**비용 절감 패턴 (answer route)**
- 공백 답변 → DB/engine 호출 전 조기 차단
- 완료된 세션(`sessionComplete=true`) → engine 재호출 차단
- 5000자 초과 답변 트림

**TOCTOU 방어**
`update where: { sessionComplete: false }` + Prisma P2025 에러 → 400 반환으로 중복 제출 방어.

**seung 패턴 통일 (2026-03-12)**
`resume/questions` route를 seung(PR #60)·siw(PR #61)과 동일한 패턴으로 통일:
- `Promise.all([callEngineQuestions, extractTextFromPdf])` 병렬 실행
- DB write 2회 → 1회 (create+update 제거)
- 엔진 실패 시 DB 오염 방지

### 버그 수정

- `engine/app/services/interview_service.py` `max_tokens: 1024 → 2048`
  - e2e 테스트 중 발견: 자소서 원문 포함 시 LLM 응답이 1024토큰 초과 → JSON 잘림

### 검증 결과

- Vitest: **35/35** (API 21 + UI 14)
- Playwright e2e: **1건** (29.7s, 영상 녹화 포함)
- validate-all: CRITICAL 0개 / IMPORTANT 8개 (머지 블로커 없음)
