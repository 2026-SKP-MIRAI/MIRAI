import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("@/lib/pdf-parser", () => ({
  parsePdf: vi.fn().mockResolvedValue("mock resume text"),
}));

vi.mock("@/lib/resume-repository", () => ({
  resumeRepository: {
    create: vi.fn().mockResolvedValue("mock-resume-id"),
    findById: vi.fn().mockResolvedValue("mock resume text"),
  },
}));


beforeEach(() => {
  vi.clearAllMocks();
  process.env.ENGINE_BASE_URL = "http://localhost:8000";
});

describe("POST /api/resume/questions", () => {
  it("성공 시 200 반환", async () => {
    const mockData = {
      questions: Array(8).fill({ category: "직무 역량", question: "질문?" }),
      meta: { extractedLength: 100, categoriesUsed: ["직무 역량"] },
    };
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 })
    );

    const formData = new FormData();
    formData.append("file", new File([new Uint8Array([1, 2, 3])], "test.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost/api/resume/questions", { method: "POST", body: formData });

    const { POST: handler } = await import("../../src/app/api/resume/questions/route");
    const res = await handler(req);
    expect(res.status).toBe(200);
  });

  it("파일 없음 시 400 반환", async () => {
    const formData = new FormData();
    const req = new Request("http://localhost/api/resume/questions", { method: "POST", body: formData });

    const { POST: handler } = await import("../../src/app/api/resume/questions/route");
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it("엔진 400 에러 패스스루", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "파일 크기가 너무 큽니다. 5MB 이하의 파일을 업로드해 주세요." }), { status: 400 })
    );
    const formData = new FormData();
    formData.append("file", new File([new Uint8Array([1])], "test.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost/api/resume/questions", { method: "POST", body: formData });
    const { POST: handler } = await import("../../src/app/api/resume/questions/route");
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it("엔진 422 에러 패스스루", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "PDF에 텍스트가 포함되어 있지 않습니다." }), { status: 422 })
    );
    const formData = new FormData();
    formData.append("file", new File([new Uint8Array([1])], "test.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost/api/resume/questions", { method: "POST", body: formData });
    const { POST: handler } = await import("../../src/app/api/resume/questions/route");
    const res = await handler(req);
    expect(res.status).toBe(422);
  });

  it("엔진 500 에러 패스스루", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "질문 생성 중 오류가 발생했습니다." }), { status: 500 })
    );
    const formData = new FormData();
    formData.append("file", new File([new Uint8Array([1])], "test.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost/api/resume/questions", { method: "POST", body: formData });
    const { POST: handler } = await import("../../src/app/api/resume/questions/route");
    const res = await handler(req);
    expect(res.status).toBe(500);
  });

  it("타임아웃 시 500 반환", async () => {
    mockFetch.mockRejectedValueOnce(new DOMException("signal timed out", "AbortError"));
    const formData = new FormData();
    formData.append("file", new File([new Uint8Array([1])], "test.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost/api/resume/questions", { method: "POST", body: formData });
    const { POST: handler } = await import("../../src/app/api/resume/questions/route");
    const res = await handler(req);
    expect(res.status).toBe(500);
  });
});
