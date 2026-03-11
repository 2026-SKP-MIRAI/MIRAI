# [#57] feat: [seung] Phase 1 — 패널 면접 + 꼬리질문 서비스 연동 — 구현 계획

> 작성: 2026-03-10

---

## 완료 기준

- [x] Supabase + Prisma 초기화: `resumes`, `interview_sessions` 테이블 마이그레이션
- [x] `/api/resume/questions` 라우트 수정: PDF 텍스트 추출 → `resumes` 저장 → `resumeId` 반환
- [x] `POST /api/interview/start` — `resumes`에서 resumeText 조회 → 엔진 호출 → 세션 생성
- [x] `POST /api/interview/answer` — 세션 조회 → 엔진 호출 → DB 업데이트 → nextQuestion 반환
- [x] 면접 세션 UI (`/interview?sessionId=xxx`) — 챗봇 형식: 페르소나별 질문·답변 버블, 꼬리질문 배지, 세션 완료 화면
- [x] `/resume` 완료 화면에 "면접 시작" 버튼 → `/interview?sessionId=xxx` 이동
- [x] Playwright e2e: 자소서 업로드 → 면접 시작 → 답변 → 꼬리질문 수신 전 과정
- [x] `services/seung/.ai.md` 최신화
- [x] 불변식 준수: `services/seung/src`에 `openai` / `OPENROUTER` 직접 호출 없음

---

## 구현 계획

### 기술 스택

- **프레임워크**: Next.js (App Router, TypeScript)
- **DB ORM**: Prisma 6 + Supabase PostgreSQL
- **PDF 추출**: pdf-parse 1.1.1 (서버사이드 Node.js 전용)
- **단위 테스트**: Vitest + @testing-library/react
- **E2E 테스트**: Playwright (API 모킹 + 실제 엔진·Supabase 연동)

### 설계 배경

엔진(engine #40)은 완전 stateless다. 매 호출마다 `resumeText`, `history`, `questionsQueue`를 풀 컨텍스트로 전달해야 한다. 이 상태를 어디서 관리하느냐가 Phase 1의 핵심 설계 문제였다.

엔진 응답에 `resumeText`가 포함되지 않으므로, 서비스가 PDF 원문 텍스트를 직접 추출해서 저장해야 한다. 엔진이 파싱하는 것과 서비스가 파싱하는 것이 중복처럼 보이지만, 이는 의도적인 설계다 — 엔진은 질문 생성에 집중하고, 세션 관리는 서비스 책임이다.

### 주요 아키텍처 결정

| 결정 | 이유 |
|------|------|
| Prisma 6 (v7 대신) | Prisma 7은 `url = env(...)` 지원 중단 — `prisma.config.ts` + adapter 강제, 불필요한 복잡도 |
| pdf-parse (pdfjs-dist 대신) | pdfjs-dist v5는 DOM API(DOMMatrix 등) 의존성으로 Next.js 서버 환경 실행 불가 |
| SESSION Pooler를 DIRECT_URL로 | IPv4 환경에서 Supabase Direct 연결(db.xxx.supabase.co) 미지원 — Pooler 경유 필수 |
| DB 저장 best-effort | PDF 추출 실패해도 질문 생성 결과는 항상 반환 — resumeId만 null |
| GET /api/interview/session 추가 | 면접 페이지 새로고침·직접 접근 시 세션 복원 필요 |

### 사용자 경험 설계 의도

Phase 1의 핵심 가치는 "자소서를 올리면 실제 면접관처럼 질문을 받을 수 있다"는 것이다. MVP 01에서 질문 목록을 보여 줬다면, Phase 1은 그 질문을 실제로 받고 답하는 경험을 만든다.

- **챗봇 UI**: 면접 세션을 채팅처럼 표현했다. 질문을 받고 → 답하고 → 다음 질문을 받는 흐름이 선형 채팅과 동일하기 때문이다. 사용자는 자연스럽게 메시지를 주고받는 감각으로 면접을 진행할 수 있다.

- **페르소나별 색상 구분**: 3명의 면접관(HR·기술팀장·경영진)이 번갈아 질문한다. 색상(파랑/초록/보라)으로 구분하지 않으면 누가 묻는 건지 즉각 파악하기 어렵다. 라벨만으로는 부족하다고 판단했다.

- **꼬리질문 배지**: 엔진이 `type: "follow_up"`을 내려보낼 때 주황색 배지로 표시한다. 답변이 부족하거나 더 파고들 여지가 있을 때 면접관이 꼬리질문을 던지는 현실을 그대로 반영한다. 사용자는 "아, 내 답변이 추가 설명이 필요했구나"를 바로 알 수 있다.

- **5000자 제한**: 엔진 API 계약(`currentAnswer` max 5000자)을 UI에서도 강제한다. 카운터를 보여줘서 사용자가 글자 수를 인식하며 답변을 다듬게 유도한다.

### 구현 순서 (TDD — Red → Green → Refactor)

#### Step 0: 패키지 설치 + 환경 세팅
- `npm install prisma@6 @prisma/client@6 pdf-parse@1.1.1`
- `.env.local`: `DATABASE_URL` (Transaction Pooler, port 6543), `DIRECT_URL` (Session Pooler, port 5432), `SUPABASE_SERVICE_ROLE_KEY`

#### Step 1: Prisma 스키마 + 마이그레이션
- `prisma/schema.prisma`: Resume, InterviewSession 모델 정의
  - Resume: id, resumeText, questions(Json), sessions[]
  - InterviewSession: id, resumeId(FK), questionsQueue(Json), history(Json), sessionComplete, currentQuestion, currentPersona, currentPersonaLabel
- `npx prisma migrate dev --name init` → `npx prisma generate`

#### Step 2: 유틸 라이브러리
- `src/lib/prisma.ts`: PrismaClient 싱글턴 — serverless cold start에서 커넥션 누수 방지
- `src/lib/pdf-utils.ts`: pdf-parse로 ArrayBuffer → 텍스트 추출. 실패 시 `''` 반환 (best-effort)

#### Step 3: 타입 추가 (`src/lib/types.ts`)
- PersonaType, QuestionType, QueueItem, QuestionWithPersona, HistoryItem
- QuestionsResponse에 `resumeId: string | null` 추가
- InterviewStartRequest/Response, InterviewAnswerRequest/Response, InterviewSessionState

#### Step 4: `/api/resume/questions` 수정 + 테스트
- 기존 6개 케이스 통과 유지 + 신규 3개 추가 (`questions.test.ts`)
  - resumeId 응답 포함 확인
  - Prisma mock: resume.create 호출 검증
  - PDF 추출 실패 시 resumeId=null 반환
- ArrayBuffer로 한 번만 읽기 → 엔진 호출 + PDF 추출 `Promise.all` 병렬 실행
- Prisma resumes 저장 (best-effort) → resumeId 반환

#### Step 5: `POST /api/interview/start` TDD
- `tests/api/interview-start.test.ts` 먼저 작성 (5개)
  - 성공: sessionId + firstQuestion 반환
  - resumeId 누락 → 400
  - resume 없음 → 404
  - 엔진 오류 → 500 전파
  - personas 기본값 동작 확인
- resumeText Supabase 조회 → 엔진 `/api/interview/start` 호출 → interview_sessions 생성

#### Step 6: `POST /api/interview/answer` TDD
- `tests/api/interview-answer.test.ts` 먼저 작성 (6개)
  - 성공: nextQuestion 반환 (main)
  - 꼬리질문: type="follow_up" 반환
  - sessionComplete=true: nextQuestion=null
  - sessionId 누락 → 400
  - session 없음 → 404
  - 엔진 오류 전파
- session + resume 조회 → 엔진에 풀 컨텍스트 전달 → history·queue·sessionComplete DB 업데이트

#### Step 7: `GET /api/interview/session`
- `?sessionId=xxx` → currentQuestion, currentPersonaLabel, history, sessionComplete 반환
- 면접 페이지 초기 로딩·새로고침 시 세션 복원용

#### Step 8: UI 컴포넌트 TDD
- `tests/components/InterviewChat.test.tsx` (5개)
  - 질문 버블 렌더 (페르소나 라벨 포함)
  - type="follow_up" → "꼬리질문" 배지 표시
  - sessionComplete 완료 화면 렌더
  - 답변 버블 렌더
  - 다시 시작 버튼 → onRestart 호출
- InterviewChat: 페르소나 색상 버블, 꼬리질문 배지, 완료 화면
- AnswerInput: textarea, 5000자 카운터, 제출 버튼 (sessionComplete 시 숨김)

#### Step 9: `/interview/page.tsx` (신규)
- sessionId 없으면 /resume redirect (직접 접근 방어)
- GET /api/interview/session으로 초기 세션 로드
- 답변 제출 → POST /api/interview/answer → 다음 질문 버블 렌더

#### Step 10: `/resume/page.tsx` 수정
- resumeId 상태 추가 (질문 생성 응답에서 수신)
- "면접 시작" 버튼 추가 → POST /api/interview/start → /interview?sessionId=xxx 이동

#### Step 11: Playwright E2E 테스트
- `tests/e2e/interview-flow.spec.ts` (5개 — API 모킹, 실제 엔진 불필요)
  - 업로드 → 면접 시작 → 첫 질문 버블 표시
  - 답변 제출 → 꼬리질문 배지 표시
  - 다른 페르소나 질문 전환
  - sessionComplete → 완료 화면 표시
  - sessionId 없이 /interview 접근 → /resume 리다이렉트
- `tests/e2e/real-interview-flow.spec.ts` (1개 — 실제 엔진 + Supabase 연동, 영상 녹화)
  - 이슈 #57 전체 플로우: PDF 업로드 → resumeId 생성 → 면접 시작 → 첫 질문(페르소나) → 답변 → 꼬리질문/다음 페르소나

#### Step 12: `.ai.md` 최신화
- 구조 트리, 진행 상태, 신규 파일 반영

### 최종 테스트 결과

- Vitest 단위 테스트: **41개 통과** (기존 18 + 신규 23)
- Playwright E2E (모킹): **9개 통과** (업로드 4 + 면접 플로우 5)
- Playwright E2E (실제 엔진 + Supabase): **2개 통과** (real-flow 1 + real-interview-flow 1, **24.8s**, 영상 녹화)
