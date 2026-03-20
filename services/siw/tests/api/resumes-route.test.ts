import { describe, it, expect, vi, beforeEach } from "vitest";

// --- global fetch stub ---
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

const mockCreate = vi.fn();
const mockListByUserId = vi.fn();
const mockFindDetailById = vi.fn();
vi.mock("@/lib/resume-repository", () => ({
  resumeRepository: {
    create: (...args: unknown[]) => mockCreate(...args),
    listByUserId: (...args: unknown[]) => mockListByUserId(...args),
    findDetailById: (...args: unknown[]) => mockFindDetailById(...args),
  },
}));

const mockUploadResumePdf = vi.fn().mockResolvedValue("user-123/abc.pdf");
vi.mock("@/lib/resume-storage", () => ({
  uploadResumePdf: (...args: unknown[]) => mockUploadResumePdf(...args),
}));

// --- helpers ---
const authenticatedUser = { id: "user-123", email: "test@example.com" };

function setAuthenticated(user: typeof authenticatedUser | null = authenticatedUser) {
  mockGetUser.mockResolvedValue({ data: { user } });
}

function setUnauthenticated() {
  mockGetUser.mockResolvedValue({ data: { user: null } });
}

function makePdfRequest() {
  const formData = new FormData();
  formData.append(
    "file",
    new File([new Uint8Array([1, 2, 3])], "resume.pdf", { type: "application/pdf" })
  );
  formData.append("resumeText", "추출된 이력서 텍스트");
  formData.append("targetRole", "백엔드 개발자");
  return new Request("http://localhost/api/resumes", { method: "POST", body: formData });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.ENGINE_BASE_URL = "http://localhost:8000";
  process.env.SUPABASE_STORAGE_BUCKET = "resumes";
});

// ============================================================
// POST /api/resumes — 새 동작 검증 (resumeText는 formData에서 수신)
// ============================================================
describe("POST /api/resumes", () => {
  it("/parse 호출이 발생하지 않는다", async () => {
    setAuthenticated();
    mockCreate.mockResolvedValue("new-resume-id");

    // questions 응답
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ questions: [{ category: "직무 역량", question: "질문?" }], meta: {} }),
        { status: 200 }
      )
    );
    // feedback 병렬 호출
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 })
    );

    const { POST } = await import("@/app/api/resumes/route");
    await POST(makePdfRequest());

    const parseCall = mockFetch.mock.calls.find(
      (args) => typeof args[0] === "string" && args[0].includes("/api/resume/parse")
    );
    expect(parseCall).toBeUndefined();
  });

  it("formData의 resumeText가 /questions body에 전달된다", async () => {
    setAuthenticated();
    mockCreate.mockResolvedValue("new-resume-id");

    // questions 응답
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ questions: [{ category: "직무 역량", question: "질문?" }], meta: {} }),
        { status: 200 }
      )
    );
    // feedback 병렬 호출
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 })
    );

    const { POST } = await import("@/app/api/resumes/route");
    await POST(makePdfRequest());

    const questionsFetchCall = mockFetch.mock.calls.find(
      (args) => args[0] === "http://localhost:8000/api/resume/questions"
    );
    expect(questionsFetchCall).toBeDefined();
    const questionsInit = questionsFetchCall![1] as RequestInit;
    expect(questionsInit.headers).toEqual(
      expect.objectContaining({ "Content-Type": "application/json" })
    );
    const bodyParsed = JSON.parse(questionsInit.body as string);
    expect(bodyParsed).toHaveProperty("resumeText", "추출된 이력서 텍스트");
  });

  it("응답에 { questions, resumeId } 포함", async () => {
    setAuthenticated();
    mockCreate.mockResolvedValue("new-resume-id");

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ questions: [{ category: "직무 역량", question: "질문?" }], meta: {} }),
        { status: 200 }
      )
    );
    // feedback 병렬 호출
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 })
    );

    const { POST } = await import("@/app/api/resumes/route");
    const res = await POST(makePdfRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("questions");
    expect(body).toHaveProperty("resumeId", "new-resume-id");
  });

  it("401: 미인증", async () => {
    setUnauthenticated();

    const { POST } = await import("@/app/api/resumes/route");
    const res = await POST(makePdfRequest());

    expect(res.status).toBe(401);
  });

  it("400: PDF 아닌 파일", async () => {
    setAuthenticated();

    const formData = new FormData();
    formData.append(
      "file",
      new File([new Uint8Array([1])], "resume.txt", { type: "text/plain" })
    );
    formData.append("resumeText", "텍스트");
    const req = new Request("http://localhost/api/resumes", { method: "POST", body: formData });

    const { POST } = await import("@/app/api/resumes/route");
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("POST — /api/resume/feedback URL 호출 검증", async () => {
    setAuthenticated();
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ questions: [] }) })               // questions
      .mockResolvedValueOnce({ ok: true, json: async () => ({ scores: {}, strengths: [], weaknesses: [], suggestions: [] }) }) // feedback
    mockCreate.mockResolvedValue("resume-id-1")

    const { POST } = await import("@/app/api/resumes/route")
    await POST(makePdfRequest())

    const feedbackCall = (mockFetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && c[0].includes("/api/resume/feedback")
    )
    expect(feedbackCall).toBeDefined()
  });

  it("POST — create()에 feedbackJson 포함", async () => {
    setAuthenticated();
    const feedbackData = { scores: {}, strengths: ["강점"], weaknesses: [], suggestions: [] }
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ questions: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => feedbackData })
    mockCreate.mockResolvedValue("resume-id-1")

    const { POST } = await import("@/app/api/resumes/route")
    await POST(makePdfRequest())

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ feedbackJson: feedbackData }))
  });

  it("POST — feedback fetch 실패해도 200 응답", async () => {
    setAuthenticated();
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ questions: [] }) })
      .mockRejectedValueOnce(new Error("feedback timeout"))
    mockCreate.mockResolvedValue("resume-id-1")

    const { POST } = await import("@/app/api/resumes/route")
    const res = await POST(makePdfRequest())

    expect(res.status).toBe(200)
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ feedbackJson: null }))
  });

  it("POST — targetRole이 feedback body에 포함", async () => {
    setAuthenticated();
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ questions: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    mockCreate.mockResolvedValue("resume-id-1")

    const { POST } = await import("@/app/api/resumes/route")
    await POST(makePdfRequest())

    const feedbackCall = (mockFetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && c[0].includes("/api/resume/feedback")
    )
    const body = JSON.parse(feedbackCall?.[1]?.body ?? "{}")
    expect(body.targetRole).toBe("백엔드 개발자")
  });
});

// ============================================================
// GET /api/resumes
// ============================================================
describe("GET /api/resumes", () => {
  it("200: 이력서 목록 반환", async () => {
    setAuthenticated();
    mockListByUserId.mockResolvedValue([
      {
        id: "r1",
        userId: "user-123",
        fileName: "이력서1.pdf",
        storageKey: "user-123/r1.pdf",
        resumeText: "텍스트",
        questions: [{ category: "직무 역량", question: "질문?" }],
        createdAt: new Date("2026-03-15T00:00:00Z"),
      },
    ]);

    const { GET } = await import("@/app/api/resumes/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("r1");
    expect(body[0].fileName).toBe("이력서1.pdf");
    expect(body[0].uploadedAt).toBe("2026-03-15T00:00:00.000Z");
    expect(body[0].questionCount).toBe(1);
  });

  it("401: 미인증", async () => {
    setUnauthenticated();

    const { GET } = await import("@/app/api/resumes/route");
    const res = await GET();

    expect(res.status).toBe(401);
  });
});

// ============================================================
// GET /api/resumes/[id]
// ============================================================
describe("GET /api/resumes/[id]", () => {
  it("200: 단건 조회", async () => {
    setAuthenticated();
    mockFindDetailById.mockResolvedValue({
      id: "r1",
      userId: "user-123",
      fileName: "이력서1.pdf",
      storageKey: "user-123/r1.pdf",
      resumeText: "전체 텍스트",
      questions: [{ category: "직무 역량", question: "질문?" }],
      createdAt: new Date("2026-03-15T00:00:00Z"),
    });

    const { GET } = await import("@/app/api/resumes/[id]/route");
    const req = new Request("http://localhost/api/resumes/r1", { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ id: "r1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("r1");
    expect(body.fileName).toBe("이력서1.pdf");
    expect(body.resumeText).toBe("전체 텍스트");
    expect(body.questions).toHaveLength(1);
    expect(body.uploadedAt).toBe("2026-03-15T00:00:00.000Z");
    expect(mockFindDetailById).toHaveBeenCalledWith("r1", "user-123");
  });

  it("401: 미인증", async () => {
    setUnauthenticated();

    const { GET } = await import("@/app/api/resumes/[id]/route");
    const req = new Request("http://localhost/api/resumes/r1", { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ id: "r1" }) });

    expect(res.status).toBe(401);
  });

  it("404: 없는 ID", async () => {
    setAuthenticated();
    mockFindDetailById.mockRejectedValue(new Error("Resume not found"));

    const { GET } = await import("@/app/api/resumes/[id]/route");
    const req = new Request("http://localhost/api/resumes/nonexistent", { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(404);
  });
});
