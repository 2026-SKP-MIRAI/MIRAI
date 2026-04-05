import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/engine-client", () => ({
  engineFetch: vi.fn(),
}));

// anon-cookie mock (cookies() 호출이 테스트 환경에서 동작하지 않음)
vi.mock("@/lib/anon-cookie", () => ({
  getOrCreateAnonId: vi.fn().mockResolvedValue({ anonymousId: "test-anon-uuid", isNew: false }),
  setAnonCookie: vi.fn((response: Response) => response),
  getAnonId: vi.fn().mockResolvedValue("test-anon-uuid"),
}));

const { mockMaybeSingle } = vi.hoisted(() => ({
  mockMaybeSingle: vi.fn().mockResolvedValue({ data: null }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    }),
  }),
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
  }),
}));

import { engineFetch } from "@/lib/engine-client";
import { createServiceClient } from "@/lib/supabase/server";
import { POST } from "../start/route";

const mockEngFetch = vi.mocked(engineFetch);
const mockCreateServiceClient = vi.mocked(createServiceClient);

describe("POST /api/interview/start", () => {
  beforeEach(() => {
    mockEngFetch.mockReset();
  });

  it("유효한 입력에 sessionId, firstQuestion, questionsQueue를 반환한다", async () => {
    mockEngFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        firstQuestion: { question: "자기소개를 해주세요.", persona: "hr" },
        questionsQueue: [],
      }),
    } as Response);

    const request = new Request("http://localhost/api/interview/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobCategories: ["IT/개발"], careerStage: "면접 준비 중" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    expect(data.firstQuestion).toBeDefined();
  });

  it("빈 jobCategories에 400을 반환한다", async () => {
    const request = new Request("http://localhost/api/interview/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobCategories: [], careerStage: "면접 준비 중" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("jobCategories 3개 초과에 400을 반환한다", async () => {
    const request = new Request("http://localhost/api/interview/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobCategories: ["A", "B", "C", "D"],
        careerStage: "면접 준비 중",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("resumeText를 jobCategories와 careerStage로 올바르게 조합한다", async () => {
    mockEngFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ firstQuestion: { question: "Q", persona: "hr" }, questionsQueue: [] }),
    } as Response);

    const request = new Request("http://localhost/api/interview/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobCategories: ["IT/개발", "마케팅"], careerStage: "서류 준비 중" }),
    });

    await POST(request);

    expect(mockEngFetch).toHaveBeenCalledWith(
      "/api/interview/start",
      expect.objectContaining({
        body: expect.stringContaining("직군: IT/개발, 마케팅"),
      }),
    );
  });

  it("자소서 없는 비로그인 유저는 직군 기반 resumeText를 사용한다", async () => {
    mockEngFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ firstQuestion: { question: "Q", persona: "hr" }, questionsQueue: [] }),
    } as Response);

    const request = new Request("http://localhost/api/interview/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobCategories: ["IT/개발"], careerStage: "면접 준비 중" }),
    });

    await POST(request);

    const call = mockEngFetch.mock.calls[0];
    const bodyStr = call[1]?.body as string;
    expect(bodyStr).toContain("직군: IT/개발");
    expect(bodyStr).not.toContain("[자소서]");
  });

  it("자소서 있는 로그인 유저는 resumeText에 [자소서] 내용을 포함한다", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-with-resume" } },
        }),
      },
    } as never);

    mockMaybeSingle.mockResolvedValueOnce({
      data: { resume_text: "저는 열정적인 개발자입니다." },
    });

    mockEngFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ firstQuestion: { question: "Q", persona: "hr" }, questionsQueue: [] }),
    } as Response);

    const request = new Request("http://localhost/api/interview/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobCategories: ["IT/개발"], careerStage: "면접 준비 중" }),
    });

    await POST(request);

    const call = mockEngFetch.mock.calls[0];
    const bodyStr = call[1]?.body as string;
    expect(bodyStr).toContain("[자소서]");
    expect(bodyStr).toContain("열정적인 개발자");
  });
});
