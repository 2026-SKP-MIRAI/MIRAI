# TDD 테스트 전략 — 이슈 #140

## 기존 테스트 인프라 분석

### 테스트 프레임워크
- **Vitest** v2.x — `vitest run` (1회 실행), `vitest` (watch 모드)
- **환경**: `tests/api/**` → `node` 환경 (jsdom 아님)
- **alias**: `@/` → `./src/` (vitest.config.ts에서 path.resolve로 설정)
- **setup**: `./tests/setup.ts`

### 실행 명령
```bash
# 서비스 디렉토리에서
cd services/siw

# 전체 테스트
npm test

# 특정 파일만
npx vitest run tests/api/resume-feedback-route.test.ts
npx vitest run tests/api/resumes-route.test.ts
```

### 기존 테스트의 공통 패턴

1. **import 순서**: `vitest` → global fetch stub → `next/headers` mock → `supabase/server` mock → repository mock → 기타 mock → helpers → beforeEach
2. **fetch mock**: `vi.stubGlobal("fetch", mockFetch)` — 모듈 최상단, `vi.fn()` 개별 변수로 선언
3. **auth mock 구조**:
   ```ts
   const mockGetUser = vi.fn();
   vi.mock("@/lib/supabase/server", () => ({
     createServerClient: vi.fn().mockReturnValue({
       auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
     }),
   }));
   ```
4. **repository mock 구조**:
   ```ts
   const mockCreate = vi.fn();
   vi.mock("@/lib/resume-repository", () => ({
     resumeRepository: {
       create: (...args: unknown[]) => mockCreate(...args),
       // ... 기타 메서드
     },
   }));
   ```
5. **handler import**: `beforeEach` 안에서 `vi.resetModules()` 후 `await import(...)` — 또는 `describe` 안에서 직접 dynamic import (resumes-route 패턴)
6. **params**: Next.js 15 스타일 — `{ params: Promise.resolve({ id: "..." }) }`
7. **beforeEach**: `vi.clearAllMocks()` 또는 `vi.resetModules()` + env 세팅

---

## 신규 파일: tests/api/resume-feedback-route.test.ts

> GET /api/resumes/[id]/feedback 라우트 테스트
>
> **현재 route.ts 동작 분석** (services/siw/src/app/api/resumes/[id]/feedback/route.ts):
> - 인증 확인 → findDetailById로 소유권 확인 → null 반환 (feedbackJson 컬럼 미구현)
> - findDetailById throw 시 catch에서도 null 반환 (404 미반환)
>
> **이슈 #140 구현 후 예상 동작**:
> - feedbackJson 있는 이력서 → feedbackJson 반환 (200)
> - feedbackJson=null → null 반환 (200)
> - 미인증 → 401
> - findDetailById throw → 404 (소유권 없음 또는 존재하지 않음)

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- global fetch stub (라우트에서 직접 fetch 미사용, 구조 일관성 유지) ---
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// --- mocks ---
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
}));

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
  }),
}));

const mockFindDetailById = vi.fn();
vi.mock("@/lib/resume-repository", () => ({
  resumeRepository: {
    findDetailById: (...args: unknown[]) => mockFindDetailById(...args),
  },
}));

// --- helpers ---
const authenticatedUser = { id: "user-123", email: "test@example.com" };

function setAuthenticated(user: typeof authenticatedUser | null = authenticatedUser) {
  mockGetUser.mockResolvedValue({ data: { user } });
}

function setUnauthenticated() {
  mockGetUser.mockResolvedValue({ data: { user: null } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// GET /api/resumes/[id]/feedback
// ============================================================
describe("GET /api/resumes/[id]/feedback", () => {
  it("200: feedbackJson 있는 이력서 → feedbackJson 그대로 반환", async () => {
    setAuthenticated();
    const feedbackJson = {
      overallScore: 85,
      summary: "전반적으로 우수한 이력서입니다.",
      strengths: ["명확한 직무 경험"],
      improvements: ["수치화된 성과 추가 필요"],
    };
    mockFindDetailById.mockResolvedValue({
      id: "r1",
      userId: "user-123",
      fileName: "이력서.pdf",
      storageKey: "user-123/r1.pdf",
      resumeText: "이력서 텍스트",
      questions: [],
      feedbackJson,
      createdAt: new Date("2026-03-15T00:00:00Z"),
    });

    const { GET } = await import("@/app/api/resumes/[id]/feedback/route");
    const req = new Request("http://localhost/api/resumes/r1/feedback", { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ id: "r1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(feedbackJson);
  });

  it("200 + null: feedbackJson=null인 이력서 → null 반환", async () => {
    setAuthenticated();
    mockFindDetailById.mockResolvedValue({
      id: "r1",
      userId: "user-123",
      fileName: "이력서.pdf",
      storageKey: "user-123/r1.pdf",
      resumeText: "이력서 텍스트",
      questions: [],
      feedbackJson: null,
      createdAt: new Date("2026-03-15T00:00:00Z"),
    });

    const { GET } = await import("@/app/api/resumes/[id]/feedback/route");
    const req = new Request("http://localhost/api/resumes/r1/feedback", { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ id: "r1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeNull();
  });

  it("401: 미인증 (user=null)", async () => {
    setUnauthenticated();

    const { GET } = await import("@/app/api/resumes/[id]/feedback/route");
    const req = new Request("http://localhost/api/resumes/r1/feedback", { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ id: "r1" }) });

    expect(res.status).toBe(401);
  });

  it("404: findDetailById가 throw → 404 반환", async () => {
    setAuthenticated();
    mockFindDetailById.mockRejectedValue(new Error("Resume not found"));

    const { GET } = await import("@/app/api/resumes/[id]/feedback/route");
    const req = new Request("http://localhost/api/resumes/nonexistent/feedback", { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(404);
  });
});
```

---

## 기존 파일 확장: tests/api/resumes-route.test.ts

> POST /api/resumes 에 feedbackJson 저장 로직 추가 테스트
>
> **추가할 테스트 4개** — 기존 `describe("POST /api/resumes", () => { ... })` 블록 내부에 추가

```typescript
  // -------- feedback 관련 테스트 (이슈 #140) --------

  it("feedback 엔진 병렬 호출 — /api/resume/feedback URL로 fetch 호출됨을 검증", async () => {
    setAuthenticated();
    mockCreate.mockResolvedValue("new-resume-id");

    // parse 응답
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ resumeText: "추출된 이력서 텍스트" }), { status: 200 })
    );
    // questions 응답 (Promise.all 첫 번째)
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ questions: [{ category: "직무 역량", question: "질문?" }], meta: {} }),
        { status: 200 }
      )
    );
    // feedback 응답 (Promise.all 두 번째)
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ overallScore: 80, summary: "우수" }),
        { status: 200 }
      )
    );

    const { POST } = await import("@/app/api/resumes/route");
    await POST(makePdfRequest());

    const feedbackCall = mockFetch.mock.calls.find(
      (args) => (args[0] as string).includes("/api/resume/feedback")
    );
    expect(feedbackCall).toBeDefined();
  });

  it("feedback 성공 시 create()에 feedbackJson 포함하여 호출", async () => {
    setAuthenticated();
    mockCreate.mockResolvedValue("new-resume-id");

    const feedbackPayload = { overallScore: 80, summary: "우수한 이력서" };

    // parse 응답
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ resumeText: "추출된 이력서 텍스트" }), { status: 200 })
    );
    // questions 응답
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ questions: [{ category: "직무 역량", question: "질문?" }], meta: {} }),
        { status: 200 }
      )
    );
    // feedback 응답
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(feedbackPayload), { status: 200 })
    );

    const { POST } = await import("@/app/api/resumes/route");
    await POST(makePdfRequest());

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ feedbackJson: feedbackPayload })
    );
  });

  it("feedback fetch reject 시 feedbackJson=null로 create() 호출, 응답은 200", async () => {
    setAuthenticated();
    mockCreate.mockResolvedValue("new-resume-id");

    // parse 응답
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ resumeText: "추출된 이력서 텍스트" }), { status: 200 })
    );
    // questions 응답
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ questions: [{ category: "직무 역량", question: "질문?" }], meta: {} }),
        { status: 200 }
      )
    );
    // feedback fetch → reject (네트워크 오류 등)
    mockFetch.mockRejectedValueOnce(new Error("feedback engine unreachable"));

    const { POST } = await import("@/app/api/resumes/route");
    const res = await POST(makePdfRequest());

    // 전체 응답은 200 (feedback 실패가 업로드 전체를 막지 않는다)
    expect(res.status).toBe(200);
    // create()에는 feedbackJson: null로 호출
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ feedbackJson: null })
    );
  });

  it("targetRole='소프트웨어 개발자'를 feedback fetch body에 전달", async () => {
    setAuthenticated();
    mockCreate.mockResolvedValue("new-resume-id");

    // parse 응답
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ resumeText: "추출된 이력서 텍스트" }), { status: 200 })
    );
    // questions 응답
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ questions: [{ category: "직무 역량", question: "질문?" }], meta: {} }),
        { status: 200 }
      )
    );
    // feedback 응답
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ overallScore: 80 }), { status: 200 })
    );

    // targetRole을 FormData에 포함하여 요청
    const formData = new FormData();
    formData.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "resume.pdf", { type: "application/pdf" })
    );
    formData.append("targetRole", "소프트웨어 개발자");
    const req = new Request("http://localhost/api/resumes", { method: "POST", body: formData });

    const { POST } = await import("@/app/api/resumes/route");
    await POST(req);

    const feedbackCall = mockFetch.mock.calls.find(
      (args) => (args[0] as string).includes("/api/resume/feedback")
    );
    expect(feedbackCall).toBeDefined();
    const feedbackInit = feedbackCall![1] as RequestInit;
    const bodyParsed = JSON.parse(feedbackInit.body as string);
    expect(bodyParsed).toHaveProperty("targetRole", "소프트웨어 개발자");
  });
```

---

## TDD 사이클 가이드

### Iron Law
**프로덕션 코드는 반드시 실패하는 테스트가 먼저 존재해야 작성할 수 있다.**

---

### resume-feedback-route.test.ts 사이클

#### TC-1: 200 — feedbackJson 있는 이력서 반환
- **RED**: 테스트 실행 → 현재 route.ts는 항상 `null` 반환. `expect(body).toEqual(feedbackJson)` 실패
- **GREEN**: `feedback/route.ts`에서 `resume.feedbackJson`을 읽어 반환하도록 수정
  ```ts
  return NextResponse.json(resume.feedbackJson ?? null)
  ```
- **REFACTOR**: 타입 명시, 불필요한 주석 제거

#### TC-2: 200 + null — feedbackJson=null 반환
- **RED**: TC-1 GREEN 적용 후 이 케이스는 `null`을 반환하므로 통과 가능. 단, Prisma 스키마에 `feedbackJson` 컬럼이 없으면 빌드 단계에서 실패
- **GREEN**: Prisma 스키마에 `feedbackJson Json?` 추가 후 migrate, resumeRepository 타입 업데이트
- **REFACTOR**: `ResumeRecord` 타입에 `feedbackJson?: Prisma.JsonValue | null` 추가

#### TC-3: 401 — 미인증
- **RED**: 현재 route.ts에 인증 로직이 이미 있으므로, 구현 전 테스트 추가 시 import 오류로 RED
- **GREEN**: 라우트 파일이 올바르게 구성되면 기존 auth 로직이 401 처리
- **REFACTOR**: helper `setUnauthenticated()` 패턴 일관성 확인

#### TC-4: 404 — findDetailById throw → 404
- **RED**: 현재 route.ts의 catch 블록이 `null`을 반환. `expect(res.status).toBe(404)` 실패
- **GREEN**: catch 블록을 `return NextResponse.json({ message: "이력서를 찾을 수 없습니다." }, { status: 404 })`로 변경
- **REFACTOR**: `[id]/route.ts`의 동일 패턴과 일관성 확인

---

### resumes-route.test.ts 확장 사이클

#### TC-5: feedback 엔진 병렬 호출 검증
- **RED**: 현재 `POST /api/resumes`는 `/api/resume/feedback`을 호출하지 않음. `feedbackCall`이 undefined → 실패
- **GREEN**: `Promise.all` 안에 feedback fetch 추가
  ```ts
  const [storageKey, engineData, feedbackJson] = await Promise.all([
    uploadResumePdf(...),
    fetch(`${ENGINE_BASE_URL}/api/resume/questions`, ...),
    fetch(`${ENGINE_BASE_URL}/api/resume/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText, targetRole }),
    }).then(r => r.ok ? r.json() : null).catch(() => null),
  ])
  ```
- **REFACTOR**: fetch 로직을 별도 함수로 분리 고려

#### TC-6: feedback 성공 시 create()에 feedbackJson 포함
- **RED**: 현재 `resumeRepository.create()` 호출에 `feedbackJson` 없음 → `expect.objectContaining({ feedbackJson })` 실패
- **GREEN**: create() 호출 시 `feedbackJson` 전달
  ```ts
  await resumeRepository.create({ ..., feedbackJson })
  ```
- **REFACTOR**: Prisma schema의 `create` input 타입에 `feedbackJson` 포함 확인

#### TC-7: feedback fetch reject 시 feedbackJson=null, 응답 200
- **RED**: feedback fetch reject 시 현재 구현은 전체 Promise.all이 reject → 500 반환. `expect(res.status).toBe(200)` 실패
- **GREEN**: feedback fetch에 `.catch(() => null)` 추가 — questions/upload 실패와 분리
- **REFACTOR**: 에러 로깅 (`console.warn`) 추가로 observability 확보

#### TC-8: targetRole을 feedback fetch body에 전달
- **RED**: feedback fetch body에 `targetRole`이 없음 → `expect(bodyParsed).toHaveProperty("targetRole", "소프트웨어 개발자")` 실패
- **GREEN**: formData에서 `targetRole` 읽어서 feedback fetch body에 포함
  ```ts
  const targetRole = formData.get("targetRole") as string | null
  // feedback fetch body: JSON.stringify({ resumeText, targetRole: targetRole ?? "소프트웨어 개발자" })
  ```
- **REFACTOR**: `targetRole` 기본값 상수화 고려

---

### 테스트 실행 순서 권장

```
TC-3 (401) → TC-4 (404) → TC-1 (200 with data) → TC-2 (200 null)
TC-5 (fetch called) → TC-7 (fetch reject) → TC-6 (feedbackJson in create) → TC-8 (targetRole)
```

인증·에러 경계 테스트를 먼저 통과시킨 후 핵심 기능으로 진행하는 것이 안전하다.
