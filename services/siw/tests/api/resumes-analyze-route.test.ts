import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
}));

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
  }),
}));

function setAuthenticated() {
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
}
function setUnauthenticated() {
  mockGetUser.mockResolvedValue({ data: { user: null } });
}
function makeAnalyzeRequest() {
  const formData = new FormData();
  formData.append("file", new File([new Uint8Array([1, 2, 3])], "resume.pdf", { type: "application/pdf" }));
  return new Request("http://localhost/api/resumes/analyze", { method: "POST", body: formData });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.ENGINE_BASE_URL = "http://localhost:8000";
});

describe("POST /api/resumes/analyze", () => {
  it("200: engine /analyze 성공 → { resumeText, targetRole } 반환", async () => {
    setAuthenticated();
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ resumeText: "이력서 텍스트", extractedLength: 100, targetRole: "백엔드 개발자" }), { status: 200 })
    );
    const { POST } = await import("@/app/api/resumes/analyze/route");
    const res = await POST(makeAnalyzeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resumeText).toBe("이력서 텍스트");
    expect(body.targetRole).toBe("백엔드 개발자");
  });

  it("200: targetRole='미지정'도 정상 반환", async () => {
    setAuthenticated();
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ resumeText: "텍스트", extractedLength: 50, targetRole: "미지정" }), { status: 200 })
    );
    const { POST } = await import("@/app/api/resumes/analyze/route");
    const res = await POST(makeAnalyzeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.targetRole).toBe("미지정");
  });

  it("401: 미인증", async () => {
    setUnauthenticated();
    const { POST } = await import("@/app/api/resumes/analyze/route");
    const res = await POST(makeAnalyzeRequest());
    expect(res.status).toBe(401);
  });

  it("400: PDF 아닌 파일", async () => {
    setAuthenticated();
    const formData = new FormData();
    formData.append("file", new File([new Uint8Array([1])], "resume.txt", { type: "text/plain" }));
    const req = new Request("http://localhost/api/resumes/analyze", { method: "POST", body: formData });
    const { POST } = await import("@/app/api/resumes/analyze/route");
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("400: 파일 없음", async () => {
    setAuthenticated();
    const req = new Request("http://localhost/api/resumes/analyze", { method: "POST", body: new FormData() });
    const { POST } = await import("@/app/api/resumes/analyze/route");
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("422: engine 422 → 422 전달", async () => {
    setAuthenticated();
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "PDF에 텍스트가 포함되어 있지 않습니다." }), { status: 422 })
    );
    const { POST } = await import("@/app/api/resumes/analyze/route");
    const res = await POST(makeAnalyzeRequest());
    expect(res.status).toBe(422);
  });

  it("500: engine 500 → 500 반환", async () => {
    setAuthenticated();
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "internal error" }), { status: 500 })
    );
    const { POST } = await import("@/app/api/resumes/analyze/route");
    const res = await POST(makeAnalyzeRequest());
    expect(res.status).toBe(500);
  });

  it("engine /api/resume/analyze URL 호출 검증", async () => {
    setAuthenticated();
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ resumeText: "텍스트", extractedLength: 50, targetRole: "개발자" }), { status: 200 })
    );
    const { POST } = await import("@/app/api/resumes/analyze/route");
    await POST(makeAnalyzeRequest());
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/resume/analyze",
      expect.objectContaining({ method: "POST" })
    );
  });
});
