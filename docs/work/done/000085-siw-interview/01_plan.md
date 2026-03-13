# [#85] fix: siw interview 서비스 신뢰성 개선 — 구현 계획

> 작성: 2026-03-13 | 설계: architect + db-expert + tdd-expert (3-전문가 팀 검토)

---

## 완료 기준

- [ ] `interview-repository.ts` `findById()`에서 `history`, `questionsQueue` Zod parse 적용
- [ ] `interview-service.ts` `start()`, `answer()` engine 응답 Zod parse 적용
- [ ] `playwright.config.ts` `webServer` 설정 추가
- [ ] `interview-answer-route.test.ts` P2025 → 404 케이스 테스트 추가
- [ ] `interview-service.ts` `answer()` engine 응답 캐싱 도입 (`engineResultCache`) + Prisma 마이그레이션

---

## 아키텍처 결정

| 결정 항목 | 결정 내용 | 근거 |
|-----------|-----------|------|
| 스키마 파일 | `src/lib/interview/schemas.ts` 신규 생성 | interview 도메인 응집, `types.ts` 변경 없음 |
| DB 캐시 필드명 | `engineResultCache Json?` | JSON native 타입(`jsonb`), 이슈 명세 준수 |
| Zod parse 실패 전략 | `ZodError` throw (fallback 없음) | 데이터 손상을 숨기면 근본 원인 추적 불가 |
| P2025 처리 위치 | `interview-repository.ts` `updateAfterAnswer()` | 계층 분리 — service가 Prisma 에러 코드에 의존하면 안 됨 |
| Transaction | 불필요 | 단일 UPDATE로 원자적 처리 (PostgreSQL 보장) |
| `types.ts` 변경 | 변경 안 함 | Zod 스키마와 구조 동일 → TypeScript 자동 호환 |
| `engineResultCache` null 설정 | `Prisma.DbNull` 사용 | Prisma JSON nullable 필드는 JS `null` 직접 전달 불가 — `InputJsonValue` 타입 불일치 발생. `engineResultCache === null ? Prisma.DbNull : engineResultCache` 패턴으로 변환 필요 |

> **TDD 전문가 발견**: P2025→404, session_complete→400 처리 로직은 **이미 route.ts에 존재**.
> 테스트 케이스만 없었던 것. 로직 수정 없이 테스트 추가만으로 해당 AC 충족 가능.

---

## 영향 범위 (수정 파일 목록)

```
services/siw/
├── prisma/schema.prisma                               ← engineResultCache Json? 추가
├── src/lib/interview/
│   ├── schemas.ts                                     ← 신규: Zod 스키마 전체
│   ├── interview-repository.ts                        ← Zod parse + saveEngineResult + P2025 변환
│   └── interview-service.ts                           ← engineResultCache 캐싱 + Zod parse
├── src/app/api/interview/answer/route.ts              ← session_not_found → 404 분기 추가
├── playwright.config.ts                               ← webServer + CI 환경 분기
└── tests/
    ├── api/interview-answer-route.test.ts             ← P2025/session_not_found/session_complete 테스트
    ├── unit/interview-service.test.ts                 ← 캐싱 동작, Zod parse 실패 테스트
    └── unit/interview-repository.test.ts             ← 신규: repository 단위 테스트
```

---

## 구현 단계

### Step 0: Prisma 마이그레이션 (선행 필수)

`prisma/schema.prisma` — `engineResultCache Json?` 추가:

```prisma
model InterviewSession {
  id                  String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  resumeText          String
  currentQuestion     String   @default("")
  currentPersona      String   @default("")
  currentQuestionType String   @default("main")
  questionsQueue      Json     @default("[]")
  history             Json     @default("[]")
  sessionComplete     Boolean  @default(false)
  userId              String?
  engineResultCache   Json?                          // ← 추가
  createdAt           DateTime @default(now())
  updatedAt           DateTime @default(now()) @updatedAt

  @@map("interview_sessions")
}
```

```bash
cd services/siw
npx prisma migrate dev --name add-engine-result-cache
```

- nullable 필드 → 기존 데이터 backward compatible, backfill 불필요
- Supabase: `DATABASE_URL`에 direct connection URL 사용 (pgBouncer 경유 시 migration 실패)
- 배포 시: `npx prisma migrate deploy`

---

### Step 1: `src/lib/interview/schemas.ts` 신규 생성

```typescript
import { z } from "zod";

// ─── 기본 열거형 ───────────────────────────────────────────
export const PersonaTypeSchema = z.enum(["hr", "tech_lead", "executive"]);
export const QuestionTypeSchema = z.enum(["main", "follow_up"]);

// ─── DB JSON 필드 스키마 (findById 파싱용) ────────────────
export const QueueItemSchema = z.object({
  persona: PersonaTypeSchema,
  type: QuestionTypeSchema,
});

export const HistoryItemSchema = z.object({
  persona: PersonaTypeSchema,
  personaLabel: z.string(),
  question: z.string(),
  answer: z.string(),
  type: QuestionTypeSchema,
});

export const QueueItemArraySchema = z.array(QueueItemSchema);
export const HistoryItemArraySchema = z.array(HistoryItemSchema);

// ─── 엔진 응답 스키마 ─────────────────────────────────────
export const QuestionWithPersonaSchema = z.object({
  persona: PersonaTypeSchema,
  personaLabel: z.string(),
  question: z.string(),
  type: QuestionTypeSchema.optional(),
});

/** POST /api/interview/start 엔진 응답 */
export const EngineStartResponseSchema = z.object({
  firstQuestion: QuestionWithPersonaSchema,
  questionsQueue: z.array(QueueItemSchema),
});

/** POST /api/interview/answer 엔진 응답 */
export const EngineAnswerResponseSchema = z.object({
  nextQuestion: QuestionWithPersonaSchema.nullable(),
  updatedQueue: z.array(QueueItemSchema),
  sessionComplete: z.boolean(),
});
```

---

### Step 2: `interview-repository.ts` 수정

변경 포인트:
1. `findById()` — JSON 컬럼 Zod parse + `engineResultCache` 반환
2. `saveEngineResult()` 메서드 추가 (write-ahead 캐시)
3. `updateAfterAnswer()` — P2025 → `session_not_found` 도메인 에러 변환

```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import type { QueueItem, HistoryItem } from "@/lib/types";
import { QueueItemArraySchema, HistoryItemArraySchema, QuestionTypeSchema } from "./schemas";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

export type SessionSnapshot = {
  id: string;
  resumeText: string;
  currentQuestion: string;
  currentPersona: string;
  currentQuestionType: "main" | "follow_up";
  questionsQueue: QueueItem[];
  history: HistoryItem[];
  sessionComplete: boolean;
  engineResultCache: object | null;  // ← 추가
};

export const interviewRepository = {
  async create(data: {
    resumeText: string;
    currentQuestion: string;
    currentPersona: string;
    currentQuestionType: "main" | "follow_up";
    questionsQueue: QueueItem[];
  }): Promise<string> {
    const session = await prisma.interviewSession.create({
      data: { ...data, history: [] },
    });
    return session.id;
  },

  async findById(id: string): Promise<SessionSnapshot> {
    const s = await prisma.interviewSession.findUniqueOrThrow({ where: { id } });

    // Zod parse — 타입 단언 제거, ZodError throw로 silent corruption 방지
    const questionsQueue = QueueItemArraySchema.parse(s.questionsQueue);
    const history = HistoryItemArraySchema.parse(s.history);

    return {
      id: s.id,
      resumeText: s.resumeText,
      currentQuestion: s.currentQuestion,
      currentPersona: s.currentPersona,
      currentQuestionType: QuestionTypeSchema.parse(s.currentQuestionType ?? "main"),
      questionsQueue,
      history,
      sessionComplete: s.sessionComplete,
      engineResultCache: (s.engineResultCache as object | null) ?? null,
    };
  },

  /** engine 호출 성공 직후 write-ahead 캐시 저장 */
  async saveEngineResult(id: string, result: object): Promise<void> {
    await prisma.interviewSession.update({
      where: { id },
      data: { engineResultCache: result },
    });
  },

  async updateAfterAnswer(
    id: string,
    data: {
      history: HistoryItem[];
      questionsQueue: QueueItem[];
      currentQuestion: string;
      currentPersona: string;
      currentQuestionType: "main" | "follow_up";
      sessionComplete: boolean;
      engineResultCache: object | null;  // null = 캐시 클리어
    }
  ): Promise<void> {
    try {
      await prisma.interviewSession.update({ where: { id }, data });
    } catch (e) {
      // P2025 → 도메인 에러 변환 (service가 Prisma 에러 코드에 의존하지 않도록)
      if (e instanceof PrismaClientKnownRequestError && e.code === "P2025") {
        throw new Error("session_not_found");
      }
      throw e;
    }
  },
};
```

---

### Step 3: `interview-service.ts` 수정

변경 포인트:
1. `start()` — `EngineStartResponseSchema.parse()` 적용
2. `answer()` — `engineResultCache` 캐싱 + `EngineAnswerResponseSchema.parse()` 적용

```typescript
import { interviewRepository } from "./interview-repository";
import { resumeRepository } from "@/lib/resume-repository";
import { EngineStartResponseSchema, EngineAnswerResponseSchema } from "./schemas";
import type { PersonaType, InterviewAnswerResponse } from "@/lib/types";

const ENGINE_BASE_URL = process.env.ENGINE_BASE_URL ?? "http://localhost:8000";

const PERSONA_LABELS: Record<string, string> = {
  hr: "HR 담당자",
  tech_lead: "기술 리드",
  executive: "임원",
};

export const interviewService = {
  async start(resumeId: string, personas: PersonaType[]) {
    const resumeText = await resumeRepository.findById(resumeId);
    const engineText = resumeText.slice(0, 1200);
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
    if (!resp?.ok) throw new Error("engine_start_failed");

    // ← 변경: resp.json() 타입 단언 → Zod parse
    const parsed = EngineStartResponseSchema.parse(await resp.json());

    const sessionId = await interviewRepository.create({
      resumeText,
      currentQuestion: parsed.firstQuestion.question,
      currentPersona: parsed.firstQuestion.persona,
      currentQuestionType: parsed.firstQuestion.type ?? "main",
      questionsQueue: parsed.questionsQueue,
    });

    return { sessionId, firstQuestion: parsed.firstQuestion };
  },

  async answer(sessionId: string, currentAnswer: string): Promise<InterviewAnswerResponse> {
    const session = await interviewRepository.findById(sessionId);
    if (session.sessionComplete) throw new Error("session_complete");

    let engineResult: ReturnType<typeof EngineAnswerResponseSchema.parse>;

    if (session.engineResultCache) {
      // ── 캐시 HIT: engine 재호출 없이 캐시 사용 (비용 절감 + history 오염 방지) ──
      engineResult = EngineAnswerResponseSchema.parse(session.engineResultCache);
    } else {
      // ── engine 호출 ──
      const historyForEngine = session.history.map(({ type: _type, ...rest }) => rest);
      let resp: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        resp = await fetch(`${ENGINE_BASE_URL}/api/interview/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resumeText: session.resumeText,
            history: historyForEngine,
            questionsQueue: session.questionsQueue,
            currentQuestion: session.currentQuestion,
            currentPersona: session.currentPersona,
            currentAnswer,
          }),
          signal: AbortSignal.timeout(55000),
        });
        if (resp.ok) break;
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      }
      if (!resp?.ok) throw new Error("engine_answer_failed");

      // ← 변경: resp.json() 타입 단언 → Zod parse
      engineResult = EngineAnswerResponseSchema.parse(await resp.json());

      // write-ahead: 재시도 시 engine 재호출 방지를 위해 결과 먼저 저장
      await interviewRepository.saveEngineResult(sessionId, engineResult);
    }

    const updatedHistory = [
      ...session.history,
      {
        persona: session.currentPersona as PersonaType,
        personaLabel: PERSONA_LABELS[session.currentPersona] ?? session.currentPersona,
        question: session.currentQuestion,
        answer: currentAnswer,
        type: session.currentQuestionType,
      },
    ];

    // 최종 업데이트 + 캐시 클리어 (단일 UPDATE = 원자적)
    await interviewRepository.updateAfterAnswer(sessionId, {
      history: updatedHistory,
      questionsQueue: engineResult.updatedQueue,
      currentQuestion: engineResult.nextQuestion?.question ?? "",
      currentPersona: engineResult.nextQuestion?.persona ?? "",
      currentQuestionType: engineResult.nextQuestion?.type ?? "main",
      sessionComplete: engineResult.sessionComplete,
      engineResultCache: null,
    });

    return {
      nextQuestion: engineResult.nextQuestion,
      updatedQueue: engineResult.updatedQueue,
      sessionComplete: engineResult.sessionComplete,
    };
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

---

### Step 4: `answer/route.ts` 수정

`session_not_found` → 404 분기 추가 (1줄 추가):

```typescript
// 변경 전 catch 블록:
} catch (e) {
  if (e instanceof Error && e.message === "session_complete")
    return Response.json({ message: "이미 완료된 면접 세션입니다." }, { status: 400 });
  const status =
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025" ? 404 : 500;
  return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewAnswerFailed }, { status });
}

// 변경 후:
} catch (e) {
  if (e instanceof Error && e.message === "session_complete")
    return Response.json({ message: "이미 완료된 면접 세션입니다." }, { status: 400 });
  if (e instanceof Error && e.message === "session_not_found")   // ← 추가 (1줄)
    return Response.json({ message: ENGINE_ERROR_MESSAGES.sessionNotFound }, { status: 404 });
  const status =
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025" ? 404 : 500;
  return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewAnswerFailed }, { status });
}
```

> 기존 P2025 직접 체크는 `findById()` → `findUniqueOrThrow()`가 throw하는 경우를 위해 유지.
> `updateAfterAnswer()`의 P2025는 이제 `session_not_found`로 변환되어 위 분기에서 처리됨.

---

### Step 5: `playwright.config.ts` 수정

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  webServer: {                                       // ← 추가
    command: "npm run dev -- -p 3001",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  use: {
    baseURL: "http://localhost:3001",
    headless: !!process.env.CI,                      // ← 수정: CI에서 headless
    video: process.env.CI ? "retain-on-failure" : "on",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
```

> `npm run dev -- -p 3001`: package.json의 dev 스크립트가 포트를 이미 3001로 지정한다면 `npm run dev`만 사용.

---

### Step 6: 테스트 작성

#### 6-1. `tests/api/interview-answer-route.test.ts` 추가 케이스

```typescript
// 파일 상단 import 추가
import { Prisma } from "@prisma/client";

// ── 추가할 테스트 케이스들 ──

it("404: P2025 에러 (세션 없음)", async () => {
  const { interviewService } = await import("@/lib/interview/interview-service");
  const p2025Error = new Prisma.PrismaClientKnownRequestError(
    "No InterviewSession found",
    { code: "P2025", clientVersion: "5.0.0" }
  );
  (interviewService.answer as ReturnType<typeof vi.fn>).mockRejectedValueOnce(p2025Error);
  const { POST } = await import("@/app/api/interview/answer/route");
  const req = new Request("http://localhost/api/interview/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: "nonexistent-id", currentAnswer: "내 답변" }),
  });
  const res = await POST(req);
  expect(res.status).toBe(404);
});

it("404: session_not_found 에러 (updateAfterAnswer P2025 변환)", async () => {
  const { interviewService } = await import("@/lib/interview/interview-service");
  (interviewService.answer as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
    new Error("session_not_found")
  );
  const { POST } = await import("@/app/api/interview/answer/route");
  const req = new Request("http://localhost/api/interview/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: "nonexistent-id", currentAnswer: "내 답변" }),
  });
  const res = await POST(req);
  expect(res.status).toBe(404);
});

it("400: session_complete 에러 (이미 완료된 세션)", async () => {
  const { interviewService } = await import("@/lib/interview/interview-service");
  (interviewService.answer as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
    new Error("session_complete")
  );
  const { POST } = await import("@/app/api/interview/answer/route");
  const req = new Request("http://localhost/api/interview/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: "done-session", currentAnswer: "내 답변" }),
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
  const data = await res.json();
  expect(data.message).toBe("이미 완료된 면접 세션입니다.");
});

it("400: 공백만인 답변", async () => {
  const { POST } = await import("@/app/api/interview/answer/route");
  const req = new Request("http://localhost/api/interview/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: "test-session", currentAnswer: "   " }),
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
});
```

#### 6-2. `tests/unit/interview-service.test.ts` 추가 케이스

```typescript
// interview-service.test.ts mock에 saveEngineResult 추가 필요:
// interviewRepository mock에 saveEngineResult: vi.fn() 추가

it("answer: engine 3회 실패 시 engine_answer_failed throw", async () => {
  mockFetch.mockResolvedValue({ ok: false, status: 503, text: async () => "error" });
  const { interviewService } = await import("@/lib/interview/interview-service");
  await expect(interviewService.answer("mock-session-id", "내 답변"))
    .rejects.toThrow("engine_answer_failed");
  expect(mockFetch).toHaveBeenCalledTimes(3);
});

it("answer: sessionComplete=true 시 engine 호출 없이 session_complete throw", async () => {
  vi.mocked(interviewRepository.findById).mockResolvedValueOnce({
    .../* 기존 mock 기본값 */,
    sessionComplete: true,
    engineResultCache: null,
  });
  const { interviewService } = await import("@/lib/interview/interview-service");
  await expect(interviewService.answer("mock-session-id", "내 답변"))
    .rejects.toThrow("session_complete");
  expect(mockFetch).not.toHaveBeenCalled();
});

it("answer: engineResultCache 있으면 engine 재호출 안 함 (캐시 HIT)", async () => {
  vi.mocked(interviewRepository.findById).mockResolvedValueOnce({
    .../* 기존 mock 기본값 */,
    sessionComplete: false,
    engineResultCache: {
      nextQuestion: { persona: "tech_lead", personaLabel: "기술 리드", question: "캐시 질문", type: "main" },
      updatedQueue: [],
      sessionComplete: false,
    },
  });
  const { interviewService } = await import("@/lib/interview/interview-service");
  const result = await interviewService.answer("mock-session-id", "내 답변");
  expect(mockFetch).not.toHaveBeenCalled();
  expect(result.nextQuestion?.question).toBe("캐시 질문");
});

it("answer: engine 성공 직후 saveEngineResult 호출됨", async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      nextQuestion: { persona: "tech_lead", personaLabel: "기술 리드", question: "다음 질문", type: "main" },
      updatedQueue: [],
      sessionComplete: false,
    }),
  });
  const { interviewService } = await import("@/lib/interview/interview-service");
  await interviewService.answer("mock-session-id", "내 답변");
  expect(vi.mocked(interviewRepository.saveEngineResult)).toHaveBeenCalledOnce();
});

it("answer: engine 응답 Zod 스키마 불일치 시 throw", async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ invalid: "structure" }),
  });
  const { interviewService } = await import("@/lib/interview/interview-service");
  await expect(interviewService.answer("mock-session-id", "내 답변")).rejects.toThrow();
});

it("start: engine 응답 Zod 스키마 불일치 시 throw", async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ invalid: "structure" }),
  });
  const { interviewService } = await import("@/lib/interview/interview-service");
  await expect(interviewService.start("mock-resume-id", ["hr"])).rejects.toThrow();
});
```

#### 6-3. `tests/unit/interview-repository.test.ts` 신규 파일

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@prisma/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@prisma/client")>();
  return {
    ...actual,
    PrismaClient: vi.fn().mockImplementation(() => ({
      interviewSession: {
        create: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
      },
    })),
  };
});

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: vi.fn().mockImplementation(() => ({})),
}));

describe("interviewRepository", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("정상 세션 — questionsQueue/history Zod parse 후 SessionSnapshot 반환", async () => {
      const { PrismaClient } = await import("@prisma/client");
      const mockPrisma = new (PrismaClient as ReturnType<typeof vi.fn>)();
      mockPrisma.interviewSession.findUniqueOrThrow.mockResolvedValueOnce({
        id: "session-1",
        resumeText: "이력서",
        currentQuestion: "자기소개를 해주세요.",
        currentPersona: "hr",
        currentQuestionType: "main",
        questionsQueue: [{ persona: "tech_lead", type: "main" }],
        history: [{ persona: "hr", personaLabel: "HR 담당자", question: "Q1", answer: "A1", type: "main" }],
        sessionComplete: false,
        engineResultCache: null,
      });
      const { interviewRepository } = await import("@/lib/interview/interview-repository");
      const result = await interviewRepository.findById("session-1");
      expect(result.id).toBe("session-1");
      expect(result.questionsQueue).toHaveLength(1);
      expect(result.history).toHaveLength(1);
    });

    it("currentQuestionType null → 'main' 기본값 처리", async () => {
      const { PrismaClient } = await import("@prisma/client");
      const mockPrisma = new (PrismaClient as ReturnType<typeof vi.fn>)();
      mockPrisma.interviewSession.findUniqueOrThrow.mockResolvedValueOnce({
        id: "s1", resumeText: "r", currentQuestion: "q",
        currentPersona: "hr", currentQuestionType: null,
        questionsQueue: [], history: [], sessionComplete: false, engineResultCache: null,
      });
      const { interviewRepository } = await import("@/lib/interview/interview-repository");
      const result = await interviewRepository.findById("s1");
      expect(result.currentQuestionType).toBe("main");
    });
  });

  describe("updateAfterAnswer", () => {
    it("P2025 → session_not_found 에러로 변환", async () => {
      const { PrismaClient, Prisma } = await import("@prisma/client");
      const mockPrisma = new (PrismaClient as ReturnType<typeof vi.fn>)();
      mockPrisma.interviewSession.update.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Not found", {
          code: "P2025", clientVersion: "5.0.0",
        })
      );
      const { interviewRepository } = await import("@/lib/interview/interview-repository");
      await expect(
        interviewRepository.updateAfterAnswer("nonexistent", {
          history: [], questionsQueue: [], currentQuestion: "",
          currentPersona: "", currentQuestionType: "main",
          sessionComplete: false, engineResultCache: null,
        })
      ).rejects.toThrow("session_not_found");
    });

    it("정상 업데이트 — void 반환 (에러 없음)", async () => {
      const { PrismaClient } = await import("@prisma/client");
      const mockPrisma = new (PrismaClient as ReturnType<typeof vi.fn>)();
      mockPrisma.interviewSession.update.mockResolvedValueOnce({});
      const { interviewRepository } = await import("@/lib/interview/interview-repository");
      await expect(
        interviewRepository.updateAfterAnswer("session-1", {
          history: [], questionsQueue: [], currentQuestion: "q",
          currentPersona: "hr", currentQuestionType: "main",
          sessionComplete: false, engineResultCache: null,
        })
      ).resolves.toBeUndefined();
    });
  });
});
```

---

## TDD 구현 순서 (Red → Green)

```
Phase 1 — 코드 변경 없이 테스트만 추가 (즉시)
  1. interview-answer-route.test.ts — P2025→404, session_not_found→404, session_complete→400 추가
     └─ route.ts에 이미 처리 로직 있음 → 테스트 추가만으로 즉시 Green
  2. playwright.config.ts — webServer + CI 환경 분기 (설정 변경만)

Phase 2 — Prisma + Repository + Service 수정
  3. [Red] interview-service.test.ts — Zod parse 실패, 캐싱 동작 테스트 추가
  4. Step 0: Prisma migration (engineResultCache 컬럼 추가)
  5. Step 1: schemas.ts 생성
  6. Step 2: interview-repository.ts 수정 (Zod parse + saveEngineResult + P2025)
  7. Step 3: interview-service.ts 수정 (캐싱 + Zod parse)
  8. Step 4: route.ts에 session_not_found → 404 추가
  9. [Green] vitest run 전체 통과 확인

Phase 3 — Repository 단위 테스트 신규 작성
  10. Step 6-3: interview-repository.test.ts 신규 생성
  11. [Green] vitest run 전체 통과 확인
```

---

## 의존 관계

```
Step 0 (migration)
  └─ Step 2 (repository) — Prisma 타입 재생성 필요
       └─ Step 3 (service) — repository API 변경 반영
            └─ Step 4 (route) — session_not_found 에러 추가 반영

Step 1 (schemas.ts) — Step 2, 3과 병렬 가능 (먼저 생성 후 import)
Step 5 (playwright) — 독립, 언제든 수정 가능
Step 6 (tests) — Red는 구현 전, Green은 구현 후
```

---

## 커버리지 목표

| 파일 | Phase 1 후 | Phase 2 후 | Phase 3 후 |
|------|-----------|-----------|-----------|
| `interview-answer-route.test.ts` | 분기 100% | 분기 100% | 분기 100% |
| `interview-service.test.ts` | 기존 유지 | ~85% | ~95% |
| `interview-repository.test.ts` | 없음 | 없음 | ~90% |

---

## 체크리스트

- [ ] `npx prisma migrate dev --name add-engine-result-cache`
- [ ] `src/lib/interview/schemas.ts` 신규 생성
- [ ] `interview-repository.ts` — Zod parse + `saveEngineResult()` + P2025 → `session_not_found`
- [ ] `interview-service.ts` — `engineResultCache` 캐싱 + Zod parse (start/answer)
- [ ] `answer/route.ts` — `session_not_found` → 404 분기 추가 (1줄)
- [ ] `playwright.config.ts` — `webServer` + `headless: !!process.env.CI` + CI 분기
- [ ] `tests/api/interview-answer-route.test.ts` — P2025/session_not_found/session_complete 테스트
- [ ] `tests/unit/interview-service.test.ts` — 캐싱, Zod parse 실패 테스트
- [ ] `tests/unit/interview-repository.test.ts` — 신규 파일 생성
- [ ] `npx vitest run` 전체 통과
- [ ] `services/siw/.ai.md` 최신화
