# feat: [kwan] Phase 1 — 패널 면접 + 꼬리질문 서비스 연동 (engine #40 e2e)

## 사용자 관점 목표
kwan 서비스에서 자소서 업로드 후 HR·기술팀장·경영진 3인 패널 면접 세션을 진행하고, 답변 품질에 따라 꼬리질문(CLARIFY·CHALLENGE·EXPLORE)을 받을 수 있다.

## 배경
engine #40(기능 03·04 — 패널 면접 세션 + 꼬리질문)이 완료됐으며, kwan Next.js 서비스가 이를 연동한다. MVP 01(자소서 → 질문 생성)은 완료 상태.

엔진은 완전 stateless — 세션 상태(`resumeText`, `history`, `questionsQueue`)는 kwan이 Supabase에서 관리하고, 엔진 호출 시 풀 컨텍스트를 전달한다. 엔진 `QuestionsResponse`에 `resumeText`가 포함되지 않으므로, 질문 생성 시 PDF 원문 텍스트를 서비스에서 `pdfjs-dist`로 추출해 Supabase `resumes` 테이블에 저장한다.

**엔진 수정 금지** — `engine/.ai.md` 규격에 맞게 서비스 파트만 개발한다.

## 사전 검토 필수
- `engine/.ai.md` — 엔진 API 계약 (`/api/interview/start`, `/api/interview/answer`, `/api/interview/followup`)
- `docs/specs/mvp/dev_spec.md` — 기능 03·04 명세

## 완료 기준

### Supabase + Prisma 초기화
- [ ] `@supabase/ssr`, `prisma`, `@prisma/client`, `pdfjs-dist` 설치
- [ ] Supabase 테이블: `resumes` (resumeText, questions), `interview_sessions` (resumeId FK, questionsQueue, history, sessionComplete) + RLS
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 서버 전용 (`NEXT_PUBLIC_` 절대 금지)

### API 라우트 수정·추가 (TDD)
- [ ] `/api/resume/questions` 수정 — `pdfjs-dist`로 PDF 텍스트 추출 → Supabase `resumes` 저장 → `resumeId` + questions 반환
- [ ] `POST /api/interview/start` — Supabase `resumes`에서 resumeText 조회 → engine 호출 → `interview_sessions` 생성
- [ ] `POST /api/interview/answer` — Supabase session 조회 → engine 호출 → session 업데이트 → nextQuestion 반환

### UI
- [ ] `domain/interview/types.ts` 확장 — `Persona`, `QuestionWithPersona`, `QueueItem`, `HistoryItem`, `InterviewSession`, `UploadState`에 `'interviewing'` 추가
- [ ] `QuestionList.tsx`에 "면접 시작" 버튼 → 면접 세션 페이지 이동
- [ ] `InterviewChat.tsx` — 페르소나별 질문 버블 + `AnswerInput`
- [ ] `sessionComplete: true` 시 완료 화면

### 테스트
- [ ] Vitest: `start`, `answer` 라우트 단위 테스트 (fetch mock)
- [ ] Vitest: `InterviewChat.tsx` 컴포넌트 테스트
- [ ] Playwright e2e: 자소서 업로드 → 면접 시작 → 답변 → 꼬리질문 수신 전 과정

### 불변식·문서
- [ ] `services/kwan/.ai.md` 최신화 (Supabase 스택, 신규 구조, Playwright 커맨드 추가)
- [ ] LLM 직접 호출 금지 (`import anthropic` 금지)
- [ ] engine #40 완료 확인 후 시작 (의존성)

## 구현 플랜
1. **Supabase + Prisma 초기화** — 패키지 설치, `lib/supabase/` 클라이언트 유틸, 테이블 + RLS
2. **`/api/resume/questions` 수정** — `pdfjs-dist` 텍스트 추출 → `resumes` 저장 → `resumeId` 반환
3. **API 라우트 TDD** — `start/route.ts`, `answer/route.ts` Red → Green → Refactor
4. **UI 컴포넌트** — `InterviewChat.tsx`, `QuestionList.tsx` "면접 시작" 버튼
5. **면접 페이지 + 완료 화면** — `app/interview/page.tsx`
6. **Playwright e2e** — `playwright.config.ts` 추가, e2e 작성

## 개발 체크리스트
- [ ] 테스트 코드 포함 (Vitest unit + Playwright e2e)
- [ ] `services/kwan/.ai.md` 최신화
- [ ] 불변식 위반 없음
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 서버 전용 확인

---

## 작업 내역

