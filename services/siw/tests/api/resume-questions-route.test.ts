import { describe, it, expect, vi, beforeEach } from "vitest";

// --- global fetch stub ---
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ENGINE_BASE_URL = "http://localhost:8000";
});

// ============================================================
// POST /api/resume/questions — TDD RED: 새 동작 검증
// ============================================================
describe("POST /api/resume/questions", () => {
  it("engine /api/resume/parse 를 fetch로 호출한다", async () => {
    // parse 응답
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ resumeText: "추출된 이력서 텍스트" }), { status: 200 })
    );
    // questions 응답
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ questions: Array(8).fill({ category: "직무 역량", question: "질문?" }), meta: {} }),
        { status: 200 }
      )
    );

    const formData = new FormData();
    formData.append("file", new File([new Uint8Array([1, 2, 3])], "test.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost/api/resume/questions", { method: "POST", body: formData });

    const { POST: handler } = await import("../../src/app/api/resume/questions/route");
    await handler(req);

    // /api/resume/parse 가 호출되어야 한다
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/resume/parse",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("resumeText를 JSON body로 /api/resume/questions 에 전송한다", async () => {
    // parse 응답
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ resumeText: "추출된 이력서 텍스트" }), { status: 200 })
    );
    // questions 응답
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ questions: Array(8).fill({ category: "직무 역량", question: "질문?" }), meta: {} }),
        { status: 200 }
      )
    );

    const formData = new FormData();
    formData.append("file", new File([new Uint8Array([1, 2, 3])], "test.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost/api/resume/questions", { method: "POST", body: formData });

    const { POST: handler } = await import("../../src/app/api/resume/questions/route");
    await handler(req);

    // /api/resume/questions 가 JSON body로 호출되어야 한다
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

  it("engine /parse 에러 시 상태 코드 전파", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ detail: "PDF에 텍스트가 포함되어 있지 않습니다." }),
        { status: 422 }
      )
    );

    const formData = new FormData();
    formData.append("file", new File([new Uint8Array([1])], "test.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost/api/resume/questions", { method: "POST", body: formData });

    const { POST: handler } = await import("../../src/app/api/resume/questions/route");
    const res = await handler(req);

    expect(res.status).toBe(422);
  });

  it("engine /questions 에러 시 상태 코드 전파", async () => {
    // parse 성공
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ resumeText: "텍스트" }), { status: 200 })
    );
    // questions 실패
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ detail: "질문 생성 중 오류가 발생했습니다." }),
        { status: 500 }
      )
    );

    const formData = new FormData();
    formData.append("file", new File([new Uint8Array([1])], "test.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost/api/resume/questions", { method: "POST", body: formData });

    const { POST: handler } = await import("../../src/app/api/resume/questions/route");
    const res = await handler(req);

    expect(res.status).toBe(500);
  });

  it("파일 없음 시 400 반환", async () => {
    const formData = new FormData();
    const req = new Request("http://localhost/api/resume/questions", { method: "POST", body: formData });

    const { POST: handler } = await import("../../src/app/api/resume/questions/route");
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it("성공 시 200 반환", async () => {
    const mockData = {
      questions: Array(8).fill({ category: "직무 역량", question: "질문?" }),
      meta: { extractedLength: 100, categoriesUsed: ["직무 역량"] },
    };
    // parse 응답
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ resumeText: "추출된 텍스트" }), { status: 200 })
    );
    // questions 응답
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
});
