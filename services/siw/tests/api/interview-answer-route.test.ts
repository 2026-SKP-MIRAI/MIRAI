import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";

function makeSSEBody(events: object[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = events.map(e => `data: ${JSON.stringify(e)}\n\n`).join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(lines));
      controller.close();
    },
  });
}

const doneEvent = {
  type: "done",
  nextQuestion: { persona: "tech_lead", personaLabel: "기술 리드", question: "기술 질문", type: "main" },
  updatedQueue: [],
  sessionComplete: false,
};

vi.mock("@/lib/interview/interview-service", () => ({
  interviewService: {
    answerStream: vi.fn().mockResolvedValue(
      new Response(makeSSEBody([doneEvent]), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    ),
  },
}));

vi.mock("@/lib/interview/interview-repository", () => ({
  interviewRepository: {
    findById: vi.fn().mockResolvedValue({
      userId: "user-123",
      history: [],
      currentPersona: "hr",
      currentPersonaLabel: "HR 담당자",
      currentQuestion: "자기소개 해주세요",
      currentQuestionType: "main",
    }),
    saveEngineResult: vi.fn().mockResolvedValue(undefined),
    updateAfterAnswer: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }),
    },
  }),
}));

describe("POST /api/interview/answer", () => {
  it("200: text/event-stream 응답 + done 이벤트에 sessionComplete 포함", async () => {
    const { POST } = await import("@/app/api/interview/answer/route");
    const req = new Request("http://localhost/api/interview/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "test-session", currentAnswer: "내 답변" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
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
    (interviewService.answerStream as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("error"));
    const { POST } = await import("@/app/api/interview/answer/route");
    const req = new Request("http://localhost/api/interview/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "test-session", currentAnswer: "내 답변" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("404: P2025 에러 (세션 없음)", async () => {
    const { interviewService } = await import("@/lib/interview/interview-service");
    const p2025Error = new Prisma.PrismaClientKnownRequestError(
      "No InterviewSession found",
      { code: "P2025", clientVersion: "5.0.0" }
    );
    (interviewService.answerStream as ReturnType<typeof vi.fn>).mockRejectedValueOnce(p2025Error);
    const { POST } = await import("@/app/api/interview/answer/route");
    const req = new Request("http://localhost/api/interview/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "nonexistent-id", currentAnswer: "내 답변" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("404: session_not_found 에러", async () => {
    const { interviewService } = await import("@/lib/interview/interview-service");
    (interviewService.answerStream as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("session_not_found")
    );
    const { POST } = await import("@/app/api/interview/answer/route");
    const req = new Request("http://localhost/api/interview/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "nonexistent-id", currentAnswer: "내 답변" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("400: session_complete (이미 완료된 세션)", async () => {
    const { interviewService } = await import("@/lib/interview/interview-service");
    (interviewService.answerStream as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("session_complete")
    );
    const { POST } = await import("@/app/api/interview/answer/route");
    const req = new Request("http://localhost/api/interview/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "done-session", currentAnswer: "내 답변" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toBe("이미 완료된 면접 세션입니다.");
  });

  it("400: 공백만인 답변", async () => {
    const { POST } = await import("@/app/api/interview/answer/route");
    const req = new Request("http://localhost/api/interview/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "test-session", currentAnswer: "   " }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
