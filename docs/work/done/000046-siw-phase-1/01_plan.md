# [#46] feat: [siw] Phase 1 — 패널 면접 + 꼬리질문 서비스 연동 — 구현 계획

> 작성: 2026-03-09 / 수정: 2026-03-10 (구현 완료 후 갱신)

---

## 완료 기준

- [x] `POST /api/interview/start` — engine 프록시 + Prisma 저장 → sessionId + firstQuestion 반환
- [x] `POST /api/interview/answer` — Prisma 조회 → engine 프록시 → Prisma 갱신 → nextQuestion 반환
- [x] `POST /api/interview/followup` — engine 프록시 → followupQuestion 반환
- [x] 면접 세션 UI (`/interview/[sessionId]`) — 질문 버블, 답변 입력, 완료 화면
- [x] QuestionList에 "면접 시작하기" 버튼 추가
- [x] Prisma 테이블: `interview_sessions` (db push)
- [x] Vitest 유닛 테스트: 32/32 통과
- [x] Playwright e2e: 2/2 통과 (업로드 → 질문 → 면접 시작 → 답변 → 완료)
- [x] `services/siw/.ai.md` 최신화

---

## 전제 조건 & 의존성

| # | 항목 | 비고 |
|---|------|------|
| 1 | engine #40 완료 | 3개 Interview API 필요 |
| 2 | Supabase 프로젝트 | Phase 1 첫 DB 도입. 팀 Supabase 프로젝트 URL·키 필요 |

> **엔진 수정 없음**: resumeText는 siw에서 `pdf-parse`로 직접 추출해 Supabase에 저장. 엔진 schemas.py / resume_service.py 수정 불필요.

---

## 아키텍처 결정

엔진은 **완전 stateless** → siw가 Prisma(Supabase PostgreSQL)로 세션 관리. resumeText는 siw 서버에서 PDF 파싱으로 확보.

```
[업로드 → 질문 생성 (MVP 01 확장)]
  PDF 파일 수신 (siw /api/resume/questions)
  ├── siw: pdf-parse(v2 PDFParse 클래스)로 resumeText 추출
  ├── siw → engine /api/resume/questions (file 전달, questions 수신)
  ├── siw: resumeText DB 저장 → resumeId 발급
  └── siw 응답: { questions, meta, resumeId }  ← 클라이언트에 resumeId만 전달

[면접 시작]
  클라이언트: resumeId 포함해 POST /api/interview/start
  siw: DB에서 resumeId → resumeText 조회
  siw → engine POST /api/interview/start (resumeText + personas, 3회 재시도)
  engine → firstQuestion + questionsQueue 반환
  siw: Prisma INSERT interview_sessions (resumeText, firstQuestion 텍스트, firstQuestion 페르소나, questionsQueue)
  siw → { sessionId, firstQuestion }

[답변마다]
  클라이언트: { sessionId, currentAnswer }
  siw: Prisma에서 (resumeText, history, questionsQueue, currentQuestion, currentPersona) 로드
  siw → engine POST /api/interview/answer (풀 컨텍스트 6필드 전달)
  engine → nextQuestion + updatedQueue + sessionComplete 반환
  siw: Prisma UPDATE (history append, queue 교체, currentQuestion/currentPersona 갱신)
  siw → { nextQuestion, sessionComplete }
```

---

## DDD 레이어 구조

```
src/
├── app/
│   └── api/
│       ├── resume/questions/route.ts      # 얇은 진입점 (검증 + service 호출)
│       └── interview/
│           ├── start/route.ts             # 얇은 진입점
│           ├── answer/route.ts            # 얇은 진입점
│           └── followup/route.ts          # 얇은 진입점
├── lib/
│   ├── types.ts                           # Domain 타입 (공유 계약)
│   ├── error-messages.ts                  # 에러 메시지
│   ├── supabase/
│   │   ├── server.ts                      # Infrastructure: Supabase 서버 클라이언트
│   │   └── browser.ts                     # Infrastructure: Supabase 브라우저 클라이언트
│   └── interview/
│       ├── interview-repository.ts        # Infrastructure: Prisma 데이터 접근 추상화
│       └── interview-service.ts           # Application Service: 비즈니스 로직 오케스트레이션
├── components/
│   ├── QuestionList.tsx                   # UI
│   ├── InterviewChat.tsx                  # UI
│   ├── AnswerInput.tsx                    # UI
│   └── SessionComplete.tsx               # UI
└── app/
    └── interview/[sessionId]/page.tsx     # 면접 세션 페이지
```

**레이어 책임:**
- **API Route** — 요청 파싱·검증, `InterviewService` 호출, 응답 반환. Prisma/fetch 직접 사용 금지.
- **InterviewService** — engine 호출 + repository 오케스트레이션. 비즈니스 규칙 위치.
- **InterviewRepository** — Prisma CRUD 추상화. DB 관련 코드 전담.

---

## 신규/수정 파일 목록

| 파일 | 작업 |
|------|------|
| `src/lib/types.ts` | **EXTEND** — Interview 타입 7종 추가 |
| `src/lib/pdf-parser.ts` | **NEW** — pdf-parse v2 추상화 (vitest mock 용이) |
| `src/lib/interview/interview-repository.ts` | **NEW** — Prisma CRUD 추상화 (create, findById, updateAfterAnswer) |
| `src/lib/interview/interview-service.ts` | **NEW** — start/answer/followup + 재시도 로직 |
| `src/lib/supabase/server.ts` | **NEW** — Supabase 서버 클라이언트 (auth 준비용) |
| `src/lib/supabase/browser.ts` | **NEW** — Supabase 브라우저 클라이언트 (auth 준비용) |
| `src/lib/resume-repository.ts` | **NEW** — ResumeSession Prisma CRUD 추상화 |
| `src/lib/types.ts` | QuestionsResponse.resumeText → resumeId 변경 |
| `src/app/api/resume/questions/route.ts` | **EXTEND** — parsePdf() 호출, resumeId 응답에 포함 |
| `src/app/api/interview/start/route.ts` | **NEW** — 검증 + interviewService.start() 호출 |
| `src/app/api/interview/answer/route.ts` | **NEW** — 검증 + interviewService.answer() 호출 |
| `src/app/api/interview/followup/route.ts` | **NEW** — 검증 + interviewService.followup() 호출 |
| `src/components/QuestionList.tsx` | **EXTEND** — "면접 시작하기" 버튼 + router.push |
| `src/components/InterviewChat.tsx` | **NEW** — 페르소나 레이블 + 질문/답변 버블 |
| `src/app/interview/[sessionId]/page.tsx` | **NEW** — 면접 세션 페이지 (답변입력·완료 인라인) |
| `src/lib/error-messages.ts` | **EXTEND** — Interview 에러 키 3종 추가 |
| `next.config.ts` | **NEW** — `serverExternalPackages: ["pdf-parse"]` |
| `prisma/schema.prisma` | **NEW** — InterviewSession 모델 |
| `prisma.config.ts` | **NEW** — Prisma v7 CLI 설정 (datasource URL, dotenv) |
| `playwright.config.ts` | **NEW** — e2e 설정 (baseURL, timeout 180s) |
| `vitest.config.ts` | **EXTEND** — `exclude: ["tests/e2e/**"]`, node env 추가 |
| `tests/unit/interview-service.test.ts` | **NEW** — Service 단위 테스트 (2개) |
| `tests/api/interview-start-route.test.ts` | **NEW** — start route 테스트 (3개) |
| `tests/api/interview-answer-route.test.ts` | **NEW** — answer route 테스트 (3개) |
| `tests/api/resume-questions-route.test.ts` | **EXTEND** — `vi.mock("@/lib/pdf-parser")` 추가 |
| `tests/ui/interview-chat.test.tsx` | **NEW** — InterviewChat 렌더링 테스트 (2개) |
| `tests/ui/question-results.test.tsx` | **EXTEND** — `vi.mock("next/navigation")` + resumeText 추가 |
| `tests/e2e/interview-session.spec.ts` | **NEW** — Playwright e2e (2개) |
| `services/siw/.ai.md` | **UPDATE** |

> **미구현**: `tests/unit/interview-repository.test.ts` — Prisma v7 어댑터 mock 복잡도로 생략, service 테스트로 커버.

---

## 구현 계획

### 0단계 — 패키지 설치

```bash
cd services/siw
npm install @supabase/ssr @supabase/supabase-js
npm install prisma @prisma/client
npm install @prisma/adapter-pg pg        # Prisma v7 드라이버 어댑터 필수
npm install pdf-parse                    # v2.x (PDFParse 클래스 API)
npm install dotenv                       # prisma.config.ts에서 .env 로드용
npm install --save-dev @types/pg @playwright/test
npx prisma init
```

`package.json` scripts 추가:
```json
"db:generate": "prisma generate",
"db:push": "prisma db push",
"test:e2e": "playwright test"
```

---

### 1단계 — 환경변수 (.env.local)

```env
# 엔진
ENGINE_BASE_URL=http://localhost:8000

# Supabase — 서버 전용 (절대 NEXT_PUBLIC_ 금지)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Supabase — 클라이언트 노출 허용
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Prisma DB 연결
DATABASE_URL=postgresql://...@db.xxxx.supabase.co:6543/postgres?pgbouncer=true&sslmode=require
DIRECT_URL=postgresql://...@db.xxxx.supabase.co:5432/postgres?sslmode=require
```

---

### 2단계 — Prisma schema.prisma

> ⚠️ **Prisma v7 변경사항**: `url`/`directUrl`이 schema.prisma에서 제거됨. `prisma.config.ts`로 분리.

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]  // v7 드라이버 어댑터 활성화
}

datasource db {
  provider = "postgresql"
  // url/directUrl 없음 — prisma.config.ts에서 관리
}

model ResumeSession {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  resumeText String
  createdAt  DateTime @default(now())

  @@map("resume_sessions")
}

model InterviewSession {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  resumeText      String
  currentQuestion     String   @default("")   // 현재 답변 중인 질문 텍스트 (answer 복원용)
  currentPersona      String   @default("")   // 현재 질문의 페르소나 (answer 복원용)
  currentQuestionType String   @default("main")  // "main" | "follow_up" (역량 평가용)
  questionsQueue  Json     @default("[]")
  history         Json     @default("[]")
  sessionComplete Boolean  @default(false)
  userId          String?                        // auth 연동 전까지 null 허용
  createdAt       DateTime @default(now())
  updatedAt       DateTime @default(now()) @updatedAt

  @@map("interview_sessions")
}
```

**`prisma.config.ts`** (CLI 전용 — DIRECT_URL 사용):
```typescript
import path from "node:path";
import { defineConfig } from "prisma/config";
import "dotenv/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: { url: process.env.DIRECT_URL! },
});
```

```bash
npx prisma generate
npx prisma db push   # migrate 대신 db push 사용
```

---

### 3단계 — RLS SQL (Supabase SQL Editor에서 실행)

> Prisma는 RLS를 자동 활성화하지 않으므로 별도 실행 필수.

```sql
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;

-- service_role 키만 접근 허용 (Next.js 서버 API route 전용)
CREATE POLICY "service role only"
  ON interview_sessions
  USING (auth.role() = 'service_role');
```

---

### 4단계 — Supabase 클라이언트 파일

**`src/lib/supabase/server.ts`** (API route 전용 — SERVICE_ROLE_KEY로 RLS 우회):
```typescript
import { createClient } from "@supabase/supabase-js";

export function createServiceClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

**`src/lib/supabase/browser.ts`** (클라이언트 컴포넌트용):
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

---

### 5단계 — types.ts 확장

```typescript
export type PersonaType = "hr" | "tech_lead" | "executive";
export type FollowupType = "CLARIFY" | "CHALLENGE" | "EXPLORE";

export type QueueItem = { persona: PersonaType; type: "main" | "follow_up" };
export type QuestionWithPersona = {
  persona: PersonaType;
  personaLabel: string;
  question: string;
  type?: "main" | "follow_up";
};
export type HistoryItem = {
  persona: PersonaType;
  personaLabel: string;
  question: string;
  answer: string;
  type: "main" | "follow_up";  // 역량 평가용 질문 유형 구분
};
export type InterviewAnswerResponse = {
  nextQuestion: QuestionWithPersona | null; // sessionComplete=true 시 null
  updatedQueue: QueueItem[];
  sessionComplete: boolean;
};

// MVP 01 기존 타입 확장 — resumeText는 DB 저장 후 resumeId만 클라이언트에 전달
export type QuestionsResponse = {
  questions: QuestionItem[];
  meta: { extractedLength: number; categoriesUsed: string[] };
  resumeId: string; // ResumeSession DB 저장 후 발급된 ID (resumeText는 서버 전용)
};
```

---

### 6단계 — /api/resume/questions 확장 (resumeText 추출 + DB 저장 → resumeId 반환)

> ⚠️ **pdf-parse v2 변경사항**: v1처럼 `pdfParse(buffer)` 함수 형태가 아닌 `PDFParse` 클래스 사용.
> webpack 번들링 문제로 `next.config.ts`에 `serverExternalPackages: ["pdf-parse"]` 추가 필수.

**`src/lib/pdf-parser.ts`** (추상화 레이어 — vitest mock 용이):
```typescript
// pdf-parse는 next.config.ts의 serverExternalPackages로 webpack 제외
export async function parsePdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = require("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text;
}
```

**`next.config.ts`** (신규 생성):
```typescript
const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
};
```

route.ts에서 사용:
```typescript
import { parsePdf } from "@/lib/pdf-parser";
import { resumeRepository } from "@/lib/resume-repository";
// ...
resumeText = await parsePdf(buffer);
// ...
const resumeId = await resumeRepository.create(resumeText);
return Response.json({ ...engineData, resumeId });
```

vitest mock:
```typescript
vi.mock("@/lib/pdf-parser", () => ({
  parsePdf: vi.fn().mockResolvedValue("mock resume text"),
}));
```

---

### 7단계 — Repository + Service + API 라우트

**`src/lib/interview/interview-repository.ts`** (Infrastructure — Prisma 전담):

> ⚠️ **Prisma v7**: `new PrismaClient()` 단독 사용 불가. `adapter` 또는 `accelerateUrl` 필수.

```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { QueueItem, HistoryItem } from "@/lib/types";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

export type SessionSnapshot = {
  id: string;
  resumeText: string;
  currentQuestion: string;
  currentPersona: string;
  questionsQueue: QueueItem[];
  history: HistoryItem[];
  sessionComplete: boolean;
};

export const interviewRepository = {
  async create(data: {
    resumeText: string;
    currentQuestion: string;
    currentPersona: string;
    questionsQueue: QueueItem[];
  }): Promise<string> {
    const session = await prisma.interviewSession.create({
      data: {
        resumeText: data.resumeText,
        currentQuestion: data.currentQuestion,
        currentPersona: data.currentPersona,
        questionsQueue: data.questionsQueue,
        history: [],
      },
    });
    return session.id;
  },

  async findById(id: string): Promise<SessionSnapshot> {
    const s = await prisma.interviewSession.findUniqueOrThrow({ where: { id } });
    return {
      id: s.id,
      resumeText: s.resumeText,
      currentQuestion: s.currentQuestion,
      currentPersona: s.currentPersona,
      questionsQueue: s.questionsQueue as QueueItem[],
      history: s.history as HistoryItem[],
      sessionComplete: s.sessionComplete,
    };
  },

  async updateAfterAnswer(
    id: string,
    data: {
      history: HistoryItem[];
      questionsQueue: QueueItem[];
      currentQuestion: string;
      currentPersona: string;
      sessionComplete: boolean;
    }
  ): Promise<void> {
    await prisma.interviewSession.update({ where: { id }, data });
  },
};
```

**`src/lib/interview/interview-service.ts`** (Application Service — 비즈니스 로직):
```typescript
import { interviewRepository } from "./interview-repository";
import type { PersonaType, QuestionWithPersona, InterviewAnswerResponse } from "@/lib/types";

const ENGINE_BASE_URL = process.env.ENGINE_BASE_URL ?? "http://localhost:8000";

const PERSONA_LABELS: Record<string, string> = {
  hr: "HR 담당자",
  tech_lead: "기술 리드",
  executive: "임원",
};

export const interviewService = {
  async start(resumeId: string, personas: PersonaType[]) {
    const resumeText = await resumeRepository.findById(resumeId);
    // 엔진 LLM output token limit 대응: resumeText 1200자로 제한
    const engineText = resumeText.slice(0, 1200);
    // 엔진 LLM JSON 파싱 오류 간헐적 발생 → 3회 재시도
    let resp: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      resp = await fetch(`${ENGINE_BASE_URL}/api/interview/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: engineText, personas, mode: "panel" }),
        signal: AbortSignal.timeout(30000),
      });
      if (resp.ok) break;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }
    if (!resp!.ok) throw new Error("engine_start_failed");

    const { firstQuestion, questionsQueue } = await resp.json();

    const sessionId = await interviewRepository.create({
      resumeText,
      currentQuestion: firstQuestion.question,
      currentPersona: firstQuestion.persona,
      currentQuestionType: firstQuestion.type ?? "main",
      questionsQueue,
    });

    return { sessionId, firstQuestion: firstQuestion as QuestionWithPersona };
  },

  async answer(sessionId: string, currentAnswer: string): Promise<InterviewAnswerResponse> {
    const session = await interviewRepository.findById(sessionId);

    const resp = await fetch(`${ENGINE_BASE_URL}/api/interview/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeText: session.resumeText,
        history: session.history,
        questionsQueue: session.questionsQueue,
        currentQuestion: session.currentQuestion,  // Prisma에서 복원
        currentPersona: session.currentPersona,    // Prisma에서 복원
        currentAnswer,
      }),
      signal: AbortSignal.timeout(55000),
    });
    if (!resp.ok) throw new Error("engine_answer_failed");

    const { nextQuestion, updatedQueue, sessionComplete } = await resp.json();

    const updatedHistory = [
      ...session.history,
      {
        persona: session.currentPersona,
        personaLabel: session.currentQuestion, // InterviewChat이 렌더링에 사용
        question: session.currentQuestion,
        answer: currentAnswer,
        type: session.currentQuestionType,
      },
    ];

    await interviewRepository.updateAfterAnswer(sessionId, {
      history: updatedHistory,
      questionsQueue: updatedQueue,
      currentQuestion: nextQuestion?.question ?? "",
      currentPersona: nextQuestion?.persona ?? "",
      currentQuestionType: nextQuestion?.type ?? "main",
      sessionComplete,
    });

    return { nextQuestion, updatedQueue, sessionComplete };
  },

  async followup(sessionId: string, question: string, answer: string, persona: PersonaType) {
    const { resumeText } = await interviewRepository.findById(sessionId);

    const resp = await fetch(`${ENGINE_BASE_URL}/api/interview/followup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer, persona, resumeText }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) throw new Error("engine_followup_failed");

    return resp.json();
  },
};
```

**API 라우트 3개 — 얇은 진입점만:**

```typescript
// /api/interview/start/route.ts
export const maxDuration = 35;
export async function POST(request: Request) {
  const { resumeId, personas } = await request.json();
  if (!resumeId || !personas?.length)
    return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewStartFailed }, { status: 400 });
  try {
    const result = await interviewService.start(resumeId, personas);
    return Response.json(result);
  } catch {
    return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewStartFailed }, { status: 500 });
  }
}

// /api/interview/answer/route.ts
export const maxDuration = 60; // LLM 최대 2회 호출 대비
export async function POST(request: Request) {
  const { sessionId, currentAnswer } = await request.json();
  if (!sessionId || !currentAnswer)
    return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewAnswerFailed }, { status: 400 });
  try {
    const result = await interviewService.answer(sessionId, currentAnswer);
    return Response.json(result);
  } catch (e) {
    const status = (e as Error).message === "session_not_found" ? 404 : 500;
    return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewAnswerFailed }, { status });
  }
}

// /api/interview/followup/route.ts
export const maxDuration = 35;
export async function POST(request: Request) {
  const { sessionId, question, answer, persona } = await request.json();
  try {
    const result = await interviewService.followup(sessionId, question, answer, persona);
    return Response.json(result);
  } catch {
    return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewAnswerFailed }, { status: 500 });
  }
}
```

---

### 8단계 — UI 흐름

```
/resume 페이지 (MVP 01)
  QuestionList 표시 (resumeId prop 추가)
  └── "면접 시작하기" 버튼 (resumeId를 /api/interview/start에 전달)
      └── POST /api/interview/start → sessionId 수신
          └── router.push(`/interview/${sessionId}`)

/interview/[sessionId] 페이지
  ├── InterviewChat  — 페르소나 아이콘 + 레이블 + 질문 버블
  │                    data-testid="chat-message", data-testid="persona-label"
  ├── AnswerInput    — textarea + "답변 제출" 버튼
  │                    POST /api/interview/answer → nextQuestion 수신
  └── sessionComplete=true → SessionComplete ("면접이 완료되었습니다")
                              "다시 하기" → /resume
```

---

### 9단계 — error-messages.ts 확장

```typescript
export const ENGINE_ERROR_MESSAGES = {
  // 기존 키 유지...
  interviewStartFailed: "면접 시작에 실패했습니다. 다시 시도해주세요.",
  interviewAnswerFailed: "답변 처리 중 오류가 발생했습니다.",
  sessionNotFound:       "면접 세션을 찾을 수 없습니다.",
};
```

---

## TDD 구현 순서

### 사이클 1 — 타입 컴파일 검증
```bash
npx tsc --noEmit   # 신규 타입 추가 후 오류 0 확인
```

### 사이클 2 — DDD 레이어별 유닛 테스트

> **TDD 원칙**: Repository → Service → Route 순서로 Red → Green → Refactor.

**`tests/unit/interview-repository.test.ts`** (Infrastructure 레이어):
```typescript
// vi.mock("@prisma/client")
test_create_returns_session_id()
test_findById_returns_snapshot_with_all_fields()
test_findById_throws_on_unknown_id()
test_updateAfterAnswer_persists_history_and_queue()
```

**`tests/unit/interview-service.test.ts`** (Application Service 레이어):
```typescript
// vi.mock("@/lib/interview/interview-repository") + vi.mock("global.fetch")
// Repository는 mock → service 비즈니스 로직만 순수하게 테스트

test_start_calls_engine_and_creates_session()
test_start_stores_firstQuestion_as_currentQuestion()   // currentQuestion 저장 검증
test_start_throws_on_engine_error()

test_answer_restores_context_from_repository()         // currentQuestion/currentPersona 복원 핵심 검증
test_answer_sends_all_6_fields_to_engine()             // engine 계약 준수 검증
test_answer_updates_history_after_engine_response()
test_answer_returns_null_nextQuestion_when_sessionComplete()

test_followup_fetches_resumeText_from_repository()
test_followup_calls_engine_with_correct_payload()
```

**`tests/api/interview-start-route.test.ts`** (Route 레이어 — mock service):
```typescript
// vi.mock("@/lib/interview/interview-service")
test_start_200_returns_session_id_and_first_question()
test_start_400_missing_resume_text()
test_start_500_service_throws()
```

**`tests/api/interview-answer-route.test.ts`** (Route 레이어 — mock service):
```typescript
// vi.mock("@/lib/interview/interview-service")
test_answer_200_returns_next_question()
test_answer_200_session_complete_nextQuestion_null()
test_answer_400_missing_session_id()
test_answer_500_service_throws()
```

**`tests/ui/interview-chat.test.tsx`:**
```typescript
test_renders_interviewer_bubble_with_persona_label()
test_renders_user_answer_bubble()
test_session_complete_shows_completion_message()
```

Repository mock 패턴 (service 테스트용):
```typescript
vi.mock("@/lib/interview/interview-repository", () => ({
  interviewRepository: {
    create: vi.fn().mockResolvedValue("mock-session-id"),
    findById: vi.fn().mockResolvedValue({
      id: "mock-session-id",
      resumeText: "mock resume text",
      currentQuestion: "자기소개를 해주세요.",  // 핵심: 복원 검증
      currentPersona: "hr",
      questionsQueue: [],
      history: [],
      sessionComplete: false,
    }),
    updateAfterAnswer: vi.fn(),
  },
}));
```

### 사이클 3 — Playwright e2e (엔진 + siw 동시 실행)

**`tests/e2e/interview-session.spec.ts`:**
```typescript
const SAMPLE_RESUME = "D:/project/T아카데미/python/mirai/포폴,이력서자료/mirai_포폴,이력서,자소서/자소서_003_경영기획.pdf";

test("업로드 → 질문 생성 → 면접 시작 → 답변 → 완료", async ({ page }) => {
  // 1. /resume → PDF 업로드 → 질문 생성 (MVP 01)
  // 2. "면접 시작하기" 클릭 → /interview/[sessionId]
  // 3. 첫 질문(HR) 표시 확인 (data-testid="chat-message")
  // 4. 답변 입력 → "답변 제출" → 다음 질문 수신
  // 5. sessionComplete → "면접이 완료되었습니다" 확인
}, { timeout: 180_000 }); // LLM 10턴 체인 대비 180초

test("완료 후 '다시 하기' → /resume 복귀", async ({ page }) => { ... });
```

---

## 검증 체크리스트

```bash
# 유닛 테스트
npm run test

# e2e (엔진 켜진 상태에서)
npm run test:e2e

# 불변식
# - fetch to ENGINE_BASE_URL 만 사용, LLM 직접 호출 없음
# - SUPABASE_SERVICE_ROLE_KEY 서버 API route에서만 사용
# - services/siw/.ai.md 업데이트 완료
# - prisma/schema.prisma directUrl 설정 확인
# - currentQuestion/currentPersona Prisma 컬럼 존재 확인 (answer 복원 필수)
# - pdf-parse가 /api/resume/questions에서 resumeText 추출 확인
```

---

## 해결된 검증 이슈

| # | 이슈 | 해결 방법 |
|---|------|-----------|
| 1 | currentQuestion/currentPersona 복원 불가 | Prisma 스키마에 컬럼 추가, start/answer에서 갱신 |
| 2 | resumeText 엔진 수정 의존성 | siw에서 pdf-parse로 직접 추출 (엔진 수정 없음) |
| 3 | /api/interview/answer maxDuration 미기재 | maxDuration=60 추가 |
| 4 | Playwright e2e timeout 120초 부족 | 180초로 상향 |
| 5 | answer 테스트에 복원 로직 검증 없음 | test_answer_sends_current_question_and_persona_from_db 추가 |

## 구현 중 발견된 추가 이슈 (실제 발생)

| # | 이슈 | 원인 | 해결 방법 |
|---|------|------|-----------|
| 6 | vitest `vi.mock("pdf-parse")` 무효 | `createRequire`가 vitest 모듈 시스템 우회 | `src/lib/pdf-parser.ts` 추상화 → `vi.mock("@/lib/pdf-parser")` |
| 7 | pdf-parse v2 API 변경 | v2는 `PDFParse` 클래스, v1의 `pdfParse(buffer)` 함수 아님 | `new PDFParse({ data: buf }).getText()` |
| 8 | Next.js webpack 번들링 시 pdf-parse 충돌 | CJS 모듈을 ESM 번들러가 처리 불가 | `next.config.ts: serverExternalPackages: ["pdf-parse"]` |
| 9 | `new PrismaClient()` 단독 실패 | Prisma v7부터 드라이버 어댑터 필수 | `@prisma/adapter-pg` + `PrismaPg` 도입 |
| 10 | `prisma.config.ts`의 `env()` 환경변수 로드 실패 | CLI 실행 시 `.env` 미로드 | `import "dotenv/config"` + `process.env` 직접 참조 |
| 11 | 엔진 `/api/interview/start` 간헐적 500 | LLM이 긴 한국어 텍스트 처리 시 JSON 응답 잘림 | `interview-service.ts`에 3회 재시도 로직 추가 |
| 12 | Playwright strict mode 위반 | `.or(locator)` 복수 요소 매칭 | `.first()` 추가 |
| 13 | `personaLabel`에 질문 텍스트 할당 | `session.currentQuestion`을 personaLabel로 사용 → 시맨틱 오류 | `PERSONA_LABELS[session.currentPersona]` 매핑으로 수정 |
| 14 | `resp!.ok` null assertion 크래시 위험 | fetch가 네트워크 에러로 throw 시 resp=null → TypeError | `resp?.ok` 옵셔널 체이닝으로 변경 |
| 15 | resumeText 클라이언트 경유 보안 이슈 | 민감 데이터(자소서 전문)가 클라이언트에 노출 | ResumeSession 테이블 + resumeId 방식으로 전환 |
| 16 | engine history 아이템 `type` 필드 미인식 | siw `HistoryItem`에 `type` 추가 후 engine에 그대로 전송 → Pydantic extra field 에러 | `answer()` 전송 전 `history.map(({ type: _t, ...r }) => r)` 으로 type 제거 |
| 17 | `answer()` LLM 신뢰성 — HR→tech_lead 전환 500 | engine이 followup 판단 + 다음 질문 생성 LLM 2회 호출 시 간헐적 invalid JSON 응답 | `answer()`에 `start()`와 동일한 3회 재시도 로직 추가 |
| 18 | `answer/route.ts` 404 조건 dead code | `(e as Error).message === "session_not_found"` 은 절대 true가 안 됨 — `findUniqueOrThrow`는 Prisma `PrismaClientKnownRequestError(P2025)`를 throw | `e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025"` 로 교체 |

---

## 기술 부채 / 향후 개선 사항

### ~~resumeText 클라이언트 경유 문제~~ (해결됨)

> **해결**: ResumeSession 테이블 + resumeId 방식으로 전환. 자소서 원문은 서버 DB에만 보관되며 클라이언트에는 resumeId만 전달됨.
