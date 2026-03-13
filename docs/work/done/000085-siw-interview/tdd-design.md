# TDD 설계 문서 — interview 기능 테스트 커버리지 개선

> 작성일: 2026-03-13
> 담당: tdd-expert
> 대상 이슈: #000085-siw-interview

---

## 1. interview-answer-route.test.ts 추가 케이스

### 분석: route.ts 404 처리 로직

```typescript
// route.ts:26-28
const status =
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025" ? 404 : 500;
```

`P2025` (Prisma record not found) → 404 반환 로직이 이미 존재한다.
`session_not_found` 문자열 에러는 현재 route.ts에 없다 — 500으로 떨어진다.

**결론**: P2025 → 404 케이스 테스트가 없고, `session_complete` → 400 케이스도 테스트가 없다.

### 추가할 완전한 테스트 코드

```typescript
// tests/api/interview-answer-route.test.ts에 추가할 케이스들
// 파일 상단 import에 Prisma 추가 필요:
// import { Prisma } from "@prisma/client";

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

it("400: currentAnswer 없을 때", async () => {
  const { POST } = await import("@/app/api/interview/answer/route");
  const req = new Request("http://localhost/api/interview/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: "test-session" }),
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
});
```

**mock 전략**: `vi.mock`은 파일 상단에 호이스팅되므로 기존 mock 구조 유지.
각 it 블록 내에서 `mockRejectedValueOnce`로 케이스별 오버라이드.
`Prisma.PrismaClientKnownRequestError` 생성자에 `clientVersion` 필드가 필수임에 주의.

---

## 2. interview-service.test.ts 추가 케이스

### 분석: 현재 service 코드

- `answer()`: engine 성공 후 `interviewRepository.updateAfterAnswer()` 호출 — DB 실패해도 결과를 반환함
- **캐싱 로직 없음**: 현재 service에는 `answerDraft` 캐싱이 존재하지 않는다
- **Zod 스키마 없음**: engine 응답에 대한 Zod 검증 로직이 없다

따라서 아래 테스트 케이스들은 **현재 구현 기준**과 **구현 예정 기준** 두 가지로 설계한다.

### 2-1. 현재 구현 기준 — 추가 가능한 케이스들

```typescript
it("answer: engine 응답 ok=false 3회 후 에러 throw", async () => {
  mockFetch.mockResolvedValue({
    ok: false,
    status: 503,
    text: async () => "Service Unavailable",
  });
  const { interviewService } = await import("@/lib/interview/interview-service");
  await expect(interviewService.answer("mock-session-id", "내 답변")).rejects.toThrow(
    "engine_answer_failed"
  );
  // 3회 재시도 확인
  expect(mockFetch).toHaveBeenCalledTimes(3);
});

it("answer: DB update 실패해도 engine 결과 반환", async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      nextQuestion: { persona: "tech_lead", personaLabel: "기술 리드", question: "기술 질문" },
      updatedQueue: [],
      sessionComplete: false,
    }),
  });
  vi.mocked(interviewRepository.updateAfterAnswer).mockRejectedValueOnce(
    new Error("DB connection error")
  );
  const { interviewService } = await import("@/lib/interview/interview-service");
  // 현재 구현은 updateAfterAnswer 에러를 catch하지 않으므로 에러 전파
  await expect(interviewService.answer("mock-session-id", "내 답변")).rejects.toThrow(
    "DB connection error"
  );
});

it("start: engine 응답 ok=false 3회 후 에러 throw", async () => {
  mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => "error" });
  const { interviewService } = await import("@/lib/interview/interview-service");
  await expect(interviewService.start("mock-resume-id", ["hr"])).rejects.toThrow(
    "engine_start_failed"
  );
  expect(mockFetch).toHaveBeenCalledTimes(3);
});

it("answer: sessionComplete=true인 세션에서 session_complete 에러 throw", async () => {
  vi.mocked(interviewRepository.findById).mockResolvedValueOnce({
    id: "mock-session-id",
    resumeText: "resume",
    currentQuestion: "마지막 질문",
    currentPersona: "hr",
    currentQuestionType: "main",
    questionsQueue: [],
    history: [],
    sessionComplete: true,  // 이미 완료
  });
  const { interviewService } = await import("@/lib/interview/interview-service");
  await expect(interviewService.answer("mock-session-id", "내 답변")).rejects.toThrow(
    "session_complete"
  );
  // engine 호출 없음
  expect(mockFetch).not.toHaveBeenCalled();
});
```

### 2-2. Zod 검증 추가 후 테스트 케이스 (구현 예정 기준)

이 케이스들은 **Zod 스키마를 service에 추가한 뒤** Green이 되도록 설계한 Red 테스트다.

```typescript
// Zod 스키마 추가 후 사용할 테스트 케이스들

it("answer: engine 응답에 nextQuestion.question 없으면 에러 throw", async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      // nextQuestion.question 누락 — 스키마 불일치
      nextQuestion: { persona: "tech_lead", personaLabel: "기술 리드" },
      updatedQueue: [],
      sessionComplete: false,
    }),
  });
  const { interviewService } = await import("@/lib/interview/interview-service");
  await expect(interviewService.answer("mock-session-id", "내 답변")).rejects.toThrow();
});

it("start: engine 응답에 firstQuestion 없으면 에러 throw", async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      // firstQuestion 누락
      questionsQueue: [],
    }),
  });
  const { interviewService } = await import("@/lib/interview/interview-service");
  await expect(interviewService.start("mock-resume-id", ["hr"])).rejects.toThrow();
});

it("answer: engine 응답에 sessionComplete가 boolean이 아니면 에러 throw", async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      nextQuestion: { persona: "hr", personaLabel: "HR 담당자", question: "다음 질문" },
      updatedQueue: [],
      sessionComplete: "yes",  // boolean 이어야 함
    }),
  });
  const { interviewService } = await import("@/lib/interview/interview-service");
  await expect(interviewService.answer("mock-session-id", "내 답변")).rejects.toThrow();
});
```

### 2-3. 캐싱 동작 테스트 (answerDraft 캐싱 구현 후)

현재 service에는 `answerDraft` 캐싱이 없다. 아래는 캐싱 레이어 추가 후 작성할 Red 테스트다.

```typescript
// answerDraft 캐싱 추가 후 사용할 테스트 케이스들

it("answer: engine 성공 후 DB update 실패 시 answerDraft에 결과 저장", async () => {
  // engine은 성공, DB update는 실패하는 시나리오
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      nextQuestion: { persona: "tech_lead", personaLabel: "기술 리드", question: "기술 질문" },
      updatedQueue: [],
      sessionComplete: false,
    }),
  });
  vi.mocked(interviewRepository.updateAfterAnswer).mockRejectedValueOnce(
    new Error("DB write failed")
  );

  // answerDraft 저장 mock
  const mockSaveDraft = vi.fn();
  // (캐싱 레이어 mock 방법은 구현에 따라 결정)

  const { interviewService } = await import("@/lib/interview/interview-service");
  const result = await interviewService.answer("mock-session-id", "내 답변");

  // engine 결과는 반환되어야 함
  expect(result.sessionComplete).toBe(false);
  // draft가 저장되어야 함
  expect(mockSaveDraft).toHaveBeenCalledWith("mock-session-id", expect.any(Object));
});

it("answer: answerDraft 있으면 engine 재호출 안 함", async () => {
  // 이전에 draft가 저장된 상태 mock
  const cachedDraft = {
    nextQuestion: { persona: "tech_lead", personaLabel: "기술 리드", question: "기술 질문" },
    updatedQueue: [],
    sessionComplete: false,
  };
  // (캐시 레이어 mock — 구현 결정 후 확정)

  const { interviewService } = await import("@/lib/interview/interview-service");
  const result = await interviewService.answer("mock-session-id", "내 답변");

  // engine 호출 없어야 함
  expect(mockFetch).not.toHaveBeenCalled();
  expect(result).toMatchObject(cachedDraft);
});
```

**mock 전략 요약**:
| 계층 | mock 방법 |
|------|-----------|
| `fetch` (engine HTTP) | `vi.stubGlobal("fetch", mockFetch)` |
| `interviewRepository` | `vi.mock("@/lib/interview/interview-repository", ...)` |
| `resumeRepository` | `vi.mock("@/lib/resume-repository", ...)` |
| Prisma 직접 에러 | `new Prisma.PrismaClientKnownRequestError(...)` 인스턴스 생성 |
| 캐시 레이어 | 구현 결정 후 — 별도 모듈이면 `vi.mock`, Map/메모리면 `vi.spyOn` |

---

## 3. playwright.config.ts webServer 설정 (완전한 코드)

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  webServer: {
    command: "npm run dev -- -p 3001",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  use: {
    baseURL: "http://localhost:3001",
    headless: !!process.env.CI,
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

**변경 사항 요약**:
| 항목 | 변경 전 | 변경 후 | 이유 |
|------|---------|---------|------|
| `webServer` | 없음 | 추가 | CI에서 서버 자동 기동 |
| `headless` | `false` (항상) | `!!process.env.CI` | 로컬은 UI 표시, CI는 headless |
| `retries` | `0` | CI 시 `1` | CI 환경 불안정 대응 |
| `reporter` | `"list"` | CI 시 `"github"` | GitHub Actions 통합 |
| `video` | `"on"` (항상) | CI 시 `"retain-on-failure"` | CI 저장소 용량 절감 |

**주의**: `npm run dev -- -p 3001`은 package.json의 dev 스크립트가 `next dev`인 경우.
`next dev -p 3001`처럼 포트 지정이 이미 되어 있다면 `npm run dev`만 사용.

---

## 4. TDD 구현 순서 (Red → Green → Refactor)

### 의존관계 그래프

```
[이슈1: P2025 → 404]         → 독립 (route.ts 이미 처리, 테스트만 추가)
[이슈2: Zod parse 실패 → 500] → service에 Zod 스키마 추가 필요
[이슈3: 캐싱 동작]            → Zod 완료 후 (캐싱은 검증 통과 후 저장)
[이슈4: playwright webServer]  → 독립 (설정 파일만 수정)
[이슈5: session_complete → 400] → 독립 (route.ts 이미 처리, 테스트만 추가)
```

### 구현 순서

#### Phase 1 — 독립 테스트 추가 (구현 변경 없음)

**Step 1: P2025 → 404 테스트** (Red → Green 즉시)

```
Red:  it("404: P2025 에러") 추가 → 통과 확인 (route.ts에 이미 로직 존재)
```

route.ts 27라인에 P2025 처리가 이미 있으므로 테스트 추가만으로 즉시 Green.

**Step 2: session_complete → 400 테스트** (Red → Green 즉시)

```
Red:  it("400: session_complete 에러") 추가 → 통과 확인 (route.ts 24-25라인에 이미 존재)
```

**Step 3: playwright.config.ts webServer 설정**

```
수정: webServer 블록 추가, headless/retries/reporter 환경 분기
확인: npx playwright test --list (서버 기동 없이 테스트 목록 확인)
```

#### Phase 2 — Zod 스키마 추가 (구현 변경 필요)

**Step 4: Zod Red 테스트 먼저 작성**

```
Red:  it("answer: nextQuestion.question 없으면 에러") — 현재 Green (에러 안 남)
      → 서비스에 Zod 없으므로 테스트가 fail하지 않음 = 잘못된 상태
      → 스키마 추가 전에 테스트 작성하면 일단 실패 (Zod parse 에러가 안 나오므로)
```

```typescript
// service.ts에 추가할 Zod 스키마 (최소 구현)
import { z } from "zod";

const QuestionSchema = z.object({
  persona: z.string(),
  personaLabel: z.string(),
  question: z.string(),
});

const AnswerResponseSchema = z.object({
  nextQuestion: QuestionSchema.nullable(),
  updatedQueue: z.array(z.unknown()),
  sessionComplete: z.boolean(),
});

const StartResponseSchema = z.object({
  firstQuestion: QuestionSchema,
  questionsQueue: z.array(z.unknown()),
});
```

```
Green: service.ts에 Zod parse 추가
       const parsed = AnswerResponseSchema.parse(await resp.json());
       → 스키마 불일치 시 ZodError throw → route에서 500 반환
```

#### Phase 3 — 캐싱 구현 (Zod 완료 후)

**Step 5: 캐싱 Red 테스트 작성**

```
Red:   it("answer: DB update 실패 시 answerDraft 저장")
       it("answer: answerDraft 있으면 engine 재호출 안 함")
       → 현재 캐싱 없으므로 두 테스트 모두 실패

Green: service.ts에 캐싱 레이어 추가
       - Map<sessionId, engineResult> 또는 별도 캐시 모듈
       - engine 성공 직후 draft 저장
       - answer() 진입 시 draft 존재하면 engine 스킵, DB update만 재시도

Refactor: 캐시 TTL, 메모리 누수 방지, 서버리스 환경 고려
```

### 전체 구현 순서 타임라인

```
1. [즉시] P2025 → 404 테스트 추가           (5분, 코드 변경 없음)
2. [즉시] session_complete → 400 테스트 추가  (5분, 코드 변경 없음)
3. [즉시] 공백 답변, currentAnswer 누락 테스트 (5분, 코드 변경 없음)
4. [즉시] playwright.config.ts webServer 설정 (10분, 설정 변경만)
5. [중간] Zod Red 테스트 작성                (10분)
6. [중간] service.ts Zod 스키마 추가         (20분)
7. [중간] Zod Green 확인                    (5분)
8. [후반] 캐싱 Red 테스트 작성              (15분)
9. [후반] service.ts 캐싱 레이어 추가       (30분)
10. [후반] 캐싱 Green + Refactor           (15분)
```

---

## 5. 테스트 커버리지 목표

### interview-answer-route.test.ts

| 케이스 | 현재 | 추가 후 |
|--------|------|---------|
| 200 정상 반환 | O | O |
| 400 sessionId 없음 | O | O |
| 400 currentAnswer 없음 | X | O (추가) |
| 400 공백 답변 | X | O (추가) |
| 400 session_complete | X | O (추가) |
| 404 P2025 에러 | X | O (추가) |
| 500 일반 에러 | O | O |

**커버리지 목표**: 분기 커버리지 100% (route.ts의 모든 조건 분기 커버)

### interview-service.test.ts

| 케이스 | 현재 | 추가 후 |
|--------|------|---------|
| start 정상 세션 생성 | O | O |
| start engine 3회 실패 | X | O (추가) |
| start Zod 스키마 불일치 | X | O (Phase 2) |
| answer DB context 복원 | O | O |
| answer history type 제거 | O | O |
| answer engine 재시도 성공 | O | O |
| answer engine 3회 실패 | X | O (추가) |
| answer session_complete 조기 차단 | X | O (추가) |
| answer Zod 스키마 불일치 | X | O (Phase 2) |
| answer DB update 실패 → draft 저장 | X | O (Phase 3) |
| answer draft 존재 → engine 스킵 | X | O (Phase 3) |

**커버리지 목표**:
- Phase 1 완료 후: 라인 커버리지 ~75%
- Phase 2 완료 후: 라인 커버리지 ~85%
- Phase 3 완료 후: 라인 커버리지 ~95%

### 핵심 시나리오 커버 여부

| 시나리오 | 현재 커버 | 목표 |
|----------|-----------|------|
| 존재하지 않는 세션 접근 | 미커버 | Phase 1 완료 |
| engine 응답 형식 오류 | 미커버 | Phase 2 완료 |
| DB 장애 시 데이터 손실 방지 | 미커버 | Phase 3 완료 |
| CI 자동 E2E 실행 | 미커버 (서버 수동 기동 필요) | playwright 설정 완료 |

---

## 6. interview-repository.test.ts (신규 파일)

### 분석: repository 코드

`findById()`는 `prisma.interviewSession.findUniqueOrThrow()`를 사용 — P2025 시 자동으로 `PrismaClientKnownRequestError` throw.
JSON 컬럼(`questionsQueue`, `history`)은 `as QueueItem[]` / `as HistoryItem[]`로 캐스팅만 함 — Zod 검증 없음.

### 완전한 테스트 파일 코드

```typescript
// tests/unit/interview-repository.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// Prisma 클라이언트 전체 mock
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

// PrismaPg adapter mock
vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: vi.fn().mockImplementation(() => ({})),
}));

describe("interviewRepository", () => {
  let mockPrisma: {
    interviewSession: {
      create: ReturnType<typeof vi.fn>;
      findUniqueOrThrow: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("정상 세션 조회 시 SessionSnapshot 반환", async () => {
      const { PrismaClient } = await import("@prisma/client");
      mockPrisma = (PrismaClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
        ?? new (PrismaClient as ReturnType<typeof vi.fn>)();

      mockPrisma.interviewSession.findUniqueOrThrow.mockResolvedValueOnce({
        id: "session-1",
        resumeText: "이력서 텍스트",
        currentQuestion: "자기소개를 해주세요.",
        currentPersona: "hr",
        currentQuestionType: "main",
        questionsQueue: [{ persona: "tech_lead", question: "기술 질문", type: "main" }],
        history: [{ persona: "hr", personaLabel: "HR 담당자", question: "Q1", answer: "A1", type: "main" }],
        sessionComplete: false,
      });

      const { interviewRepository } = await import("@/lib/interview/interview-repository");
      const result = await interviewRepository.findById("session-1");

      expect(result.id).toBe("session-1");
      expect(result.questionsQueue).toHaveLength(1);
      expect(result.history).toHaveLength(1);
      expect(result.sessionComplete).toBe(false);
    });

    it("P2025: 존재하지 않는 세션 → PrismaClientKnownRequestError throw", async () => {
      const { PrismaClient, Prisma: PrismaNamespace } = await import("@prisma/client");
      mockPrisma = (PrismaClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
        ?? new (PrismaClient as ReturnType<typeof vi.fn>)();

      const p2025 = new PrismaNamespace.PrismaClientKnownRequestError(
        "No InterviewSession found",
        { code: "P2025", clientVersion: "5.0.0" }
      );
      mockPrisma.interviewSession.findUniqueOrThrow.mockRejectedValueOnce(p2025);

      const { interviewRepository } = await import("@/lib/interview/interview-repository");
      await expect(interviewRepository.findById("nonexistent")).rejects.toMatchObject({
        code: "P2025",
      });
    });

    it("currentQuestionType null → 'main'으로 기본값 처리", async () => {
      const { PrismaClient } = await import("@prisma/client");
      mockPrisma = (PrismaClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
        ?? new (PrismaClient as ReturnType<typeof vi.fn>)();

      mockPrisma.interviewSession.findUniqueOrThrow.mockResolvedValueOnce({
        id: "session-1",
        resumeText: "이력서",
        currentQuestion: "질문",
        currentPersona: "hr",
        currentQuestionType: null,   // DB에 null 저장된 경우
        questionsQueue: [],
        history: [],
        sessionComplete: false,
      });

      const { interviewRepository } = await import("@/lib/interview/interview-repository");
      const result = await interviewRepository.findById("session-1");
      expect(result.currentQuestionType).toBe("main");
    });

    it("questionsQueue JSON 컬럼이 빈 배열이면 빈 배열 반환", async () => {
      const { PrismaClient } = await import("@prisma/client");
      mockPrisma = (PrismaClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
        ?? new (PrismaClient as ReturnType<typeof vi.fn>)();

      mockPrisma.interviewSession.findUniqueOrThrow.mockResolvedValueOnce({
        id: "session-1",
        resumeText: "이력서",
        currentQuestion: "질문",
        currentPersona: "hr",
        currentQuestionType: "main",
        questionsQueue: [],
        history: [],
        sessionComplete: false,
      });

      const { interviewRepository } = await import("@/lib/interview/interview-repository");
      const result = await interviewRepository.findById("session-1");
      expect(result.questionsQueue).toEqual([]);
      expect(result.history).toEqual([]);
    });
  });

  describe("updateAfterAnswer", () => {
    it("정상 업데이트 시 void 반환 (에러 없음)", async () => {
      const { PrismaClient } = await import("@prisma/client");
      mockPrisma = (PrismaClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
        ?? new (PrismaClient as ReturnType<typeof vi.fn>)();

      mockPrisma.interviewSession.update.mockResolvedValueOnce({});

      const { interviewRepository } = await import("@/lib/interview/interview-repository");
      await expect(
        interviewRepository.updateAfterAnswer("session-1", {
          history: [],
          questionsQueue: [],
          currentQuestion: "다음 질문",
          currentPersona: "tech_lead",
          currentQuestionType: "main",
          sessionComplete: false,
        })
      ).resolves.toBeUndefined();
    });

    it("P2025: update 대상 세션 없으면 에러 throw", async () => {
      const { PrismaClient, Prisma: PrismaNamespace } = await import("@prisma/client");
      mockPrisma = (PrismaClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
        ?? new (PrismaClient as ReturnType<typeof vi.fn>)();

      const p2025 = new PrismaNamespace.PrismaClientKnownRequestError(
        "No InterviewSession found",
        { code: "P2025", clientVersion: "5.0.0" }
      );
      mockPrisma.interviewSession.update.mockRejectedValueOnce(p2025);

      const { interviewRepository } = await import("@/lib/interview/interview-repository");
      await expect(
        interviewRepository.updateAfterAnswer("nonexistent", {
          history: [],
          questionsQueue: [],
          currentQuestion: "",
          currentPersona: "",
          currentQuestionType: "main",
          sessionComplete: false,
        })
      ).rejects.toMatchObject({ code: "P2025" });
    });
  });

  describe("create", () => {
    it("세션 생성 시 sessionId(string) 반환", async () => {
      const { PrismaClient } = await import("@prisma/client");
      mockPrisma = (PrismaClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
        ?? new (PrismaClient as ReturnType<typeof vi.fn>)();

      mockPrisma.interviewSession.create.mockResolvedValueOnce({ id: "new-session-id" });

      const { interviewRepository } = await import("@/lib/interview/interview-repository");
      const id = await interviewRepository.create({
        resumeText: "이력서",
        currentQuestion: "첫 질문",
        currentPersona: "hr",
        currentQuestionType: "main",
        questionsQueue: [],
      });
      expect(id).toBe("new-session-id");
    });
  });
});
```

### mock 전략 — repository 테스트

repository는 Prisma 클라이언트를 모듈 최상위에서 직접 인스턴스화하므로 `vi.mock("@prisma/client")`로 PrismaClient 생성자 자체를 mock해야 한다.
`vi.resetModules()` + `beforeEach`로 각 테스트마다 깨끗한 인스턴스를 보장한다.

대안: `__mocks__/prisma.ts` 파일로 전역 mock을 관리하면 테스트 파일이 단순해진다.

---

## 참고: 현재 구현 갭 정리

구현 코드를 읽어본 결과, 아래 사항을 architect/executor에게 공유한다:

1. **P2025 → 404**: route.ts에 이미 처리 로직 있음. 테스트만 없었음.
2. **session_complete → 400**: route.ts에 이미 처리 로직 있음. 테스트만 없었음.
3. **Zod 검증**: service.ts에 없음. `await resp.json()`을 그대로 구조분해함. 추가 필요.
4. **캐싱**: service.ts에 없음. engine 성공 후 DB 실패하면 결과 소실됨. 추가 필요.
5. **playwright webServer**: 설정에 없음. CI에서 수동으로 서버 기동해야 함. 설정 추가 필요.
