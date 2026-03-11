import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/interview/interview-service", () => ({
  interviewService: {
    answer: vi.fn().mockResolvedValue({
      nextQuestion: { persona: "tech_lead", personaLabel: "기술 리드", question: "기술 질문" },
      updatedQueue: [],
      sessionComplete: false,
    }),
  },
}));

describe("POST /api/interview/answer", () => {
  it("200: nextQuestion 반환", async () => {
    const { POST } = await import("@/app/api/interview/answer/route");
    const req = new Request("http://localhost/api/interview/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "test-session", currentAnswer: "내 답변" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sessionComplete).toBe(false);
  });

  it("400: sessionId 없을 때", async () => {
    const { POST } = await import("@/app/api/interview/answer/route");
    const req = new Request("http://localhost/api/interview/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentAnswer: "내 답변" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("500: service throws 시", async () => {
    const { interviewService } = await import("@/lib/interview/interview-service");
    (interviewService.answer as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("error"));
    const { POST } = await import("@/app/api/interview/answer/route");
    const req = new Request("http://localhost/api/interview/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "test-session", currentAnswer: "내 답변" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
