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

vi.mock("@/lib/resume-storage", () => ({
  uploadResumePdf: vi.fn().mockResolvedValue("user-123/abc.pdf"),
}));

vi.mock("@/lib/pdf-parser", () => ({
  parsePdf: vi.fn().mockResolvedValue("mock resume text"),
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
  process.env.ENGINE_BASE_URL = "http://localhost:8000";
  process.env.SUPABASE_STORAGE_BUCKET = "resumes";
});

// ============================================================
// POST /api/resumes
// ============================================================
describe("POST /api/resumes", () => {
  it("200: 정상 업로드", async () => {
    setAuthenticated();
    mockCreate.mockResolvedValue("new-resume-id");

    const engineData = {
      questions: [{ category: "직무 역량", question: "질문?" }],
      meta: { extractedLength: 100, categoriesUsed: ["직무 역량"] },
    };
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(engineData), { status: 200 })
    );

    const formData = new FormData();
    formData.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "resume.pdf", { type: "application/pdf" })
    );

    const req = new Request("http://localhost/api/resumes", { method: "POST", body: formData });
    const { POST } = await import("@/app/api/resumes/route");
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resumeId).toBe("new-resume-id");
    expect(body.questions).toHaveLength(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        fileName: "resume.pdf",
        storageKey: "user-123/abc.pdf",
        resumeText: "mock resume text",
      })
    );
  });

  it("401: 미인증", async () => {
    setUnauthenticated();

    const formData = new FormData();
    formData.append(
      "file",
      new File([new Uint8Array([1])], "resume.pdf", { type: "application/pdf" })
    );

    const req = new Request("http://localhost/api/resumes", { method: "POST", body: formData });
    const { POST } = await import("@/app/api/resumes/route");
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("400: PDF 아닌 파일", async () => {
    setAuthenticated();

    const formData = new FormData();
    formData.append(
      "file",
      new File([new Uint8Array([1])], "resume.txt", { type: "text/plain" })
    );

    const req = new Request("http://localhost/api/resumes", { method: "POST", body: formData });
    const { POST } = await import("@/app/api/resumes/route");
    const res = await POST(req);

    expect(res.status).toBe(400);
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

    const req = new Request("http://localhost/api/resumes", { method: "GET" });
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
