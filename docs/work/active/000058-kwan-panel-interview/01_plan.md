# [#58] feat: [kwan] Phase 1 — 패널 면접 + 꼬리질문 서비스 연동 — 구현 계획

> 작성: 2026-03-10 / 최종 업데이트: 2026-03-12 (seung 패턴 통일 반영)

---

## 완료 기준 대조

| 항목 | 상태 |
|------|------|
| Supabase + Prisma 초기화 (`resumes`, `interview_sessions` 테이블) | ✅ |
| `/api/resume/questions` — PDF 추출 → resumeId 반환 | ✅ |
| `POST /api/interview/start` — engine 호출 → session 생성 | ✅ |
| `POST /api/interview/answer` — engine 호출 → session 업데이트 | ✅ |
| `GET /api/interview/session` — 세션 상태 조회 (새로고침 복원) | ✅ |
| `QuestionList.tsx` "면접 시작" 버튼 | ✅ |
| `InterviewChat.tsx` — 페르소나 버블 + 꼬리질문 배지 + 완료 화면 | ✅ |
| Playwright e2e: PDF 업로드 → 면접 시작 → 꼬리질문 수신 전 과정 | ✅ |
| Vitest 단위 테스트 | ✅ |
| `services/kwan/.ai.md` 최신화 | ✅ |

---

## 구현 계획 (실제 실행 순서)

### 1단계 — Supabase + Prisma 초기화

- `prisma`, `@prisma/client`, `pdf-parse` 패키지 추가
- `prisma/schema.prisma` — `Resume`, `InterviewSession` 모델 정의
  - `Resume`: `id`, `resumeText`, `questions` (Json[]), `createdAt`
  - `InterviewSession`: `id`, `resumeId` (FK), `questionsQueue`, `history`, `currentQuestion`, `currentPersona`, `currentPersonaLabel`, `currentQuestionType`, `sessionComplete`, `createdAt`
- `src/lib/db.ts` — PrismaClient 싱글턴 (Node.js 환경 serverless cold start 방지)
- 환경변수: `DATABASE_URL` (pgBouncer 트랜잭션 pooling), `DIRECT_URL` (마이그레이션용)

### 2단계 — 타입 정의 확장

`src/domain/interview/types.ts` 신규 작성:

```typescript
type Persona = 'hr' | 'tech_lead' | 'executive'
type FollowupType = 'CLARIFY' | 'CHALLENGE' | 'EXPLORE'

interface QuestionWithPersona { persona, personaLabel, question, type: 'main'|'follow_up' }
interface QueueItem           { persona, type: 'main'|'follow_up' }
interface HistoryItem         { persona, personaLabel, question, answer, questionType? }
interface InterviewSession    { id, resumeId, questionsQueue, history, sessionComplete }
type UploadState = 'idle' | 'uploading' | 'done' | 'error'
```

### 3단계 — `/api/resume/questions` 수정 (TDD)

**초기 구현 (efbd340):**
```
extractText(file) → DB create(resumeText, questions:[]) → callEngine(file) → DB update(questions)
```
→ DB를 2번 write, sequential

**seung 패턴으로 통일 (2026-03-12, 미커밋):**

seung(PR #60)·siw(PR #61) 모두 동일한 패턴을 사용:
```
arrayBuffer 한 번 읽기
→ Promise.all([callEngine(engineFile), extractTextFromPdf(arrayBuffer)])  // 병렬
→ 엔진 성공 + resumeText 있으면 DB create(resumeText + questions) 단일 write
→ resumeText 없으면 resumeId: null 반환 (DB skip)
```

변경 이유:
- DB write 횟수 2→1 (불필요한 create+update 제거)
- seung/siw와 패턴 통일 → 팀 내 코드베이스 일관성
- 엔진 실패 시 DB에 쓰레기 레코드 남기지 않음

변경 상세:
- `extractTextFromPdf(File)` → `extractTextFromPdf(ArrayBuffer)` 시그니처 변경
- `new File([arrayBuffer], ...)` 로 엔진 전송용 File 재생성
- 단일 `prisma.resume.create({ resumeText, questions })`
- `prisma.resume.update` 제거

### 4단계 — `POST /api/interview/start` (TDD)

흐름: `resumeId` 검증 → DB에서 resumeText 조회 → engine 호출 → session 생성

```typescript
// engine 호출 payload
{ resumeText: resume.resumeText.slice(0, 16000), personas: ['hr','tech_lead','executive'], mode: 'panel' }

// engine 응답
{ firstQuestion: QuestionWithPersona, questionsQueue: QueueItem[] }

// DB 저장
prisma.interviewSession.create({ resumeId, questionsQueue, history:[], currentQuestion, currentPersona, ... })
```

에러 처리:
- `resumeId` 없음 → 400
- DB에 resume 없음 → 404
- engine 타임아웃 → 500 한국어 메시지
- engine 오류 응답 → engine status 그대로 전달

### 5단계 — `POST /api/interview/answer` (TDD)

흐름: `sessionId`·`answer` 검증 → session 조회(resume join) → sessionComplete 차단 → engine 호출 → session 업데이트

**비용 절감 패턴 (siw와 동일):**
- 공백 답변 조기 차단 (DB/engine 호출 전)
- 5000자 초과 답변 트림 (`answer.trim().slice(0, 5000)`)
- `sessionComplete: true` session → engine 재호출 차단

**TOCTOU 방어:**
- `prisma.interviewSession.update({ where: { id, sessionComplete: false } })`
- `P2025` 에러 → 400 "이미 완료된 면접 세션"

**HistoryItem 저장:**
```typescript
{ persona, personaLabel, question, answer, questionType: 'main'|'follow_up' }
```
→ `questionType`을 DB에 저장, engine 전송 시 제거 → 새로고침 복원과 engine 계약 동시 달성

### 6단계 — `GET /api/interview/session`

세션 상태 전체 반환 (새로고침 복원용):
```
sessionId → DB 조회 → { currentQuestion, currentPersona, history, questionsQueue, sessionComplete }
```

### 7단계 — UI 컴포넌트

**`QuestionList.tsx` 수정:**
- "면접 시작" 버튼 추가
- 클릭 → `POST /api/interview/start` → `router.push('/interview?sessionId=xxx')`

**`InterviewChat.tsx` 신규:**
- 페르소나별 색상 버블 (hr: 파랑, tech_lead: 초록, executive: 보라)
- 꼬리질문 배지: `(꼬리질문)` 표시
- `AnswerInput` + 5000자 카운터
- `sessionComplete: true` → 완료 화면 + "처음으로" 버튼

**`app/interview/page.tsx` 신규:**
- `?sessionId` 쿼리 없으면 `/` redirect
- `InterviewChat` 렌더

### 8단계 — 엔진 클라이언트 확장

`src/lib/engine-client.ts`에 `callEngineStart`, `callEngineAnswer` 추가:
- 30초 타임아웃 (`AbortSignal.timeout(30_000)`)
- `Content-Type: application/json`

### 9단계 — Playwright e2e

`e2e/interview-flow.spec.ts`:
- PDF 업로드 → 질문 생성 → "면접 시작" 클릭 → 페르소나 첫 질문 → 짧은 답변 → `(꼬리질문)` 배지 확인

**버그 수정 (e2e 과정 중 발견):**
- `engine/app/services/interview_service.py` `_call_llm()` `max_tokens: 1024 → 2048`
  - 원인: 자소서 원문이 프롬프트에 포함되면 응답 JSON이 1024토큰 초과로 잘림

---

## 기술 결정 기록

| 결정 | 이유 |
|------|------|
| Prisma 6 선택 | v7 강제 adapter 마이그레이션 없이 기존 url 방식 유지 |
| `questionType` DB 저장 | 새로고침 시 꼬리질문 type 복원 + engine 계약 준수 동시 달성 |
| resumeText `slice(0, 16000)` | engine 프롬프트 토큰 비용 제한 |
| PDF 이중 파싱 | engine 응답에 resumeText 없음 → 서비스가 직접 추출 후 DB 저장 |
| seung 패턴 통일 | DB write 2→1, 팀 코드베이스 일관성, 엔진 실패 시 DB 오염 방지 |

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `prisma/schema.prisma` | Resume, InterviewSession 모델 추가 |
| `src/lib/db.ts` | PrismaClient 싱글턴 |
| `src/domain/interview/types.ts` | 면접 타입 전체 정의 |
| `src/lib/engine-client.ts` | callEngineStart, callEngineAnswer 추가 |
| `src/app/api/resume/questions/route.ts` | PDF 추출 + DB 저장 + seung 패턴(병렬+단일 write) |
| `src/app/api/interview/start/route.ts` | 신규 |
| `src/app/api/interview/answer/route.ts` | 신규 |
| `src/app/api/interview/session/route.ts` | 신규 |
| `src/app/interview/page.tsx` | 신규 |
| `src/components/InterviewChat.tsx` | 신규 |
| `src/components/QuestionList.tsx` | "면접 시작" 버튼 추가 |
| `tests/api/resume-questions.test.ts` | seung 패턴 mock 구조 + 빈 resumeText 케이스 추가 |
| `tests/api/interview-start.test.ts` | 신규 (5 케이스) |
| `tests/api/interview-answer.test.ts` | 신규 (8 케이스) |
| `tests/components/InterviewChat.test.tsx` | 신규 (4 케이스) |
| `e2e/interview-flow.spec.ts` | Playwright e2e 신규 |
| `services/kwan/.ai.md` | Supabase 스택, 신규 구조, Playwright 커맨드 최신화 |

`engine/` — **변경 없음** (max_tokens 버그픽스는 engine 커밋으로 별도 반영)

---

## 참조

- seung Phase 1 (PR #60): `Promise.all` 병렬 처리, `StoredHistoryEntry` 패턴, `pdf-utils.ts` 서버사이드 추출
- siw Phase 1 (PR #61): DDD (Route→Service→Repository), 비용 절감 패턴, TOCTOU 방어
- engine #40: 패널 면접 세션 + 꼬리질문 엔진 계약 (`engine/.ai.md`)
