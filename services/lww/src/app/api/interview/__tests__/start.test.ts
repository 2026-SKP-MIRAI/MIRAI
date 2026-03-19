import { describe, it, expect, vi, beforeEach } from "vitest";

// engineFetch mock
vi.mock("@/lib/engine-client", () => ({
  engineFetch: vi.fn(),
}));

import { engineFetch } from "@/lib/engine-client";
import { POST } from "../start/route";

const mockEngFetch = vi.mocked(engineFetch);

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
});
