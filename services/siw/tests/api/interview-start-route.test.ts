import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/interview/interview-service", () => ({
  interviewService: {
    start: vi.fn().mockResolvedValue({
      sessionId: "test-session",
      firstQuestion: { persona: "hr", personaLabel: "HR 담당자", question: "자기소개" },
    }),
  },
}));

describe("POST /api/interview/start", () => {
  it("200: sessionId와 firstQuestion 반환", async () => {
    const { POST } = await import("@/app/api/interview/start/route");
    const req = new Request("http://localhost/api/interview/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId: "resume-id-123", personas: ["hr"] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sessionId).toBe("test-session");
  });

  it("400: resumeText 없을 때", async () => {
    const { POST } = await import("@/app/api/interview/start/route");
    const req = new Request("http://localhost/api/interview/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personas: ["hr"] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("500: service throws 시", async () => {
    const { interviewService } = await import("@/lib/interview/interview-service");
    (interviewService.start as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("engine error"));
    const { POST } = await import("@/app/api/interview/start/route");
    const req = new Request("http://localhost/api/interview/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId: "resume-id-123", personas: ["hr"] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
