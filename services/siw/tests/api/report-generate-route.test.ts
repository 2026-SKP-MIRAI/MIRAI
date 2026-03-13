import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const { mockSession, mockReportResponse } = vi.hoisted(() => ({
  mockSession: {
    id: "test-session-id",
    resumeText: "테스트 자소서",
    history: [
      { persona: "hr", personaLabel: "HR 담당자", question: "Q1", answer: "A1", type: "main" },
      { persona: "tech_lead", personaLabel: "기술 리드", question: "Q2", answer: "A2", type: "main" },
      { persona: "executive", personaLabel: "임원", question: "Q3", answer: "A3", type: "main" },
      { persona: "hr", personaLabel: "HR 담당자", question: "Q4", answer: "A4", type: "main" },
      { persona: "tech_lead", personaLabel: "기술 리드", question: "Q5", answer: "A5", type: "main" },
    ],
    sessionComplete: true,
    currentQuestion: "",
    currentPersona: "",
    currentQuestionType: "main",
    questionsQueue: [],
  },
  mockReportResponse: {
    scores: {
      communication: 80,
      problemSolving: 75,
      logicalThinking: 70,
      jobExpertise: 85,
      cultureFit: 65,
      leadership: 72,
      creativity: 68,
      sincerity: 90,
    },
    totalScore: 76,
    summary: "전반적으로 우수한 면접 역량을 보여주었습니다.",
    axisFeedbacks: [
      { axis: "communication", axisLabel: "의사소통", score: 80, type: "strength", feedback: "명확한 의사소통" },
      { axis: "problemSolving", axisLabel: "문제해결", score: 75, type: "strength", feedback: "구조적 문제 접근" },
      { axis: "logicalThinking", axisLabel: "논리적 사고", score: 70, type: "improvement", feedback: "논리 보강 필요" },
      { axis: "jobExpertise", axisLabel: "직무 전문성", score: 85, type: "strength", feedback: "전문성 우수" },
      { axis: "cultureFit", axisLabel: "조직 적합성", score: 65, type: "improvement", feedback: "협업 사례 보강" },
      { axis: "leadership", axisLabel: "리더십", score: 72, type: "improvement", feedback: "리더십 경험 추가" },
      { axis: "creativity", axisLabel: "창의성", score: 68, type: "improvement", feedback: "창의적 접근 필요" },
      { axis: "sincerity", axisLabel: "성실성", score: 90, type: "strength", feedback: "성실한 답변" },
    ],
    growthCurve: null,
  },
}));

vi.mock("@/lib/interview/interview-repository", () => ({
  interviewRepository: {
    findById: vi.fn().mockResolvedValue(mockSession),
  },
}));

describe("POST /api/report/generate", () => {
  beforeEach(() => {
    vi.resetModules();
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => mockReportResponse,
    } as Response);
  });

  it("200: history 5개 이상 세션 → 리포트 반환", async () => {
    const { interviewRepository } = await import("@/lib/interview/interview-repository");
    (interviewRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockSession);

    const { POST } = await import("@/app/api/report/generate/route");
    const req = new Request("http://localhost/api/report/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "test-session-id" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalScore).toBe(76);
    expect(data.axisFeedbacks).toHaveLength(8);
  });

  it("400: sessionId 없을 때", async () => {
    const { POST } = await import("@/app/api/report/generate/route");
    const req = new Request("http://localhost/api/report/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("422: history < 5개 세션", async () => {
    const { interviewRepository } = await import("@/lib/interview/interview-repository");
    (interviewRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...mockSession,
      history: mockSession.history.slice(0, 3),
    });

    const { POST } = await import("@/app/api/report/generate/route");
    const req = new Request("http://localhost/api/report/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "test-session-id" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.message).toContain("최소 5개");
  });

  it("404: Prisma P2025 에러 (존재하지 않는 sessionId)", async () => {
    const { interviewRepository } = await import("@/lib/interview/interview-repository");
    const p2025 = new Prisma.PrismaClientKnownRequestError("Not found", {
      code: "P2025",
      clientVersion: "5.0.0",
    });
    (interviewRepository.findById as ReturnType<typeof vi.fn>).mockRejectedValueOnce(p2025);

    const { POST } = await import("@/app/api/report/generate/route");
    const req = new Request("http://localhost/api/report/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "nonexistent-id" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("500: engine fetch 실패", async () => {
    const { interviewRepository } = await import("@/lib/interview/interview-repository");
    (interviewRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockSession);
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("fetch failed"));

    const { POST } = await import("@/app/api/report/generate/route");
    const req = new Request("http://localhost/api/report/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "test-session-id" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
