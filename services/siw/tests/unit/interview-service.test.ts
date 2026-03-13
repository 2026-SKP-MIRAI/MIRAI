import { describe, it, expect, vi, beforeEach } from "vitest";
import { interviewRepository } from "@/lib/interview/interview-repository";

vi.mock("@/lib/interview/interview-repository", () => ({
  interviewRepository: {
    create: vi.fn().mockResolvedValue("mock-session-id"),
    findById: vi.fn().mockResolvedValue({
      id: "mock-session-id",
      resumeText: "mock resume text",
      currentQuestion: "자기소개를 해주세요.",
      currentPersona: "hr",
      currentQuestionType: "main" as const,
      questionsQueue: [],
      history: [],
      sessionComplete: false,
      engineResultCache: null,
    }),
    updateAfterAnswer: vi.fn(),
    saveEngineResult: vi.fn(),
  },
}));

vi.mock("@/lib/resume-repository", () => ({
  resumeRepository: {
    create: vi.fn().mockResolvedValue("mock-resume-id"),
    findById: vi.fn().mockResolvedValue("mock resume text"),
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("interviewService", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("start: engine 호출 후 session 생성", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        firstQuestion: { persona: "hr", personaLabel: "HR 담당자", question: "자기소개" },
        questionsQueue: [],
      }),
    });
    const { interviewService } = await import("@/lib/interview/interview-service");
    const result = await interviewService.start("mock-resume-id", ["hr"]);
    expect(result.sessionId).toBe("mock-session-id");
    expect(result.firstQuestion.question).toBe("자기소개");
  });

  it("answer: DB에서 context 복원 후 engine에 6필드 전달", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        nextQuestion: { persona: "tech_lead", personaLabel: "기술 리드", question: "기술 질문" },
        updatedQueue: [],
        sessionComplete: false,
      }),
    });
    const { interviewService } = await import("@/lib/interview/interview-service");
    const result = await interviewService.answer("mock-session-id", "내 답변");
    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.currentQuestion).toBe("자기소개를 해주세요.");
    expect(body.currentPersona).toBe("hr");
    expect(body.currentAnswer).toBe("내 답변");
    expect(result.sessionComplete).toBe(false);
  });

  it("answer: history의 type 필드를 engine에 전달하지 않음", async () => {
    vi.mocked(interviewRepository.findById).mockResolvedValueOnce({
      id: "mock-session-id",
      resumeText: "mock resume text",
      currentQuestion: "자기소개를 해주세요.",
      currentPersona: "hr",
      currentQuestionType: "main",
      questionsQueue: [],
      history: [
        {
          persona: "hr",
          personaLabel: "HR 담당자",
          question: "지원 동기는?",
          answer: "열정 때문입니다.",
          type: "main",
        },
      ],
      sessionComplete: false,
      engineResultCache: null,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        nextQuestion: { persona: "tech_lead", personaLabel: "기술 리드", question: "기술 질문" },
        updatedQueue: [],
        sessionComplete: false,
      }),
    });
    const { interviewService } = await import("@/lib/interview/interview-service");
    await interviewService.answer("mock-session-id", "내 답변");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.history).toHaveLength(1);
    expect(body.history[0]).not.toHaveProperty("type");
    expect(body.history[0].persona).toBe("hr");
    expect(body.history[0].question).toBe("지원 동기는?");
  });

  it("answer: engine 3회 실패 시 engine_answer_failed throw", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503, text: async () => "error" });
    const { interviewService } = await import("@/lib/interview/interview-service");
    await expect(interviewService.answer("mock-session-id", "내 답변"))
      .rejects.toThrow("engine_answer_failed");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("answer: sessionComplete=true 시 engine 호출 없이 session_complete throw", async () => {
    vi.mocked(interviewRepository.findById).mockResolvedValueOnce({
      id: "mock-session-id",
      resumeText: "mock resume text",
      currentQuestion: "자기소개를 해주세요.",
      currentPersona: "hr",
      currentQuestionType: "main" as const,
      questionsQueue: [],
      history: [],
      sessionComplete: true,
      engineResultCache: null,
    });
    const { interviewService } = await import("@/lib/interview/interview-service");
    await expect(interviewService.answer("mock-session-id", "내 답변"))
      .rejects.toThrow("session_complete");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("answer: engineResultCache 있으면 engine 재호출 안 함 (캐시 HIT)", async () => {
    vi.mocked(interviewRepository.findById).mockResolvedValueOnce({
      id: "mock-session-id",
      resumeText: "mock resume text",
      currentQuestion: "자기소개를 해주세요.",
      currentPersona: "hr",
      currentQuestionType: "main" as const,
      questionsQueue: [],
      history: [],
      sessionComplete: false,
      engineResultCache: {
        nextQuestion: { persona: "tech_lead", personaLabel: "기술 리드", question: "캐시 질문", type: "main" },
        updatedQueue: [],
        sessionComplete: false,
      },
    });
    const { interviewService } = await import("@/lib/interview/interview-service");
    const result = await interviewService.answer("mock-session-id", "내 답변");
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.nextQuestion?.question).toBe("캐시 질문");
  });

  it("answer: engine 성공 직후 saveEngineResult 호출됨", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        nextQuestion: { persona: "tech_lead", personaLabel: "기술 리드", question: "다음 질문", type: "main" },
        updatedQueue: [],
        sessionComplete: false,
      }),
    });
    const { interviewService } = await import("@/lib/interview/interview-service");
    await interviewService.answer("mock-session-id", "내 답변");
    expect(vi.mocked(interviewRepository.saveEngineResult)).toHaveBeenCalledOnce();
  });

  it("answer: engine 응답 Zod 스키마 불일치 시 throw", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ invalid: "structure" }),
    });
    const { interviewService } = await import("@/lib/interview/interview-service");
    await expect(interviewService.answer("mock-session-id", "내 답변")).rejects.toThrow();
  });

  it("start: engine 응답 Zod 스키마 불일치 시 throw", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ invalid: "structure" }),
    });
    const { interviewService } = await import("@/lib/interview/interview-service");
    await expect(interviewService.start("mock-resume-id", ["hr"])).rejects.toThrow();
  });

  it("answer: engine 첫 번째 실패 후 재시도하여 성공", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "Internal Server Error" })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nextQuestion: { persona: "tech_lead", personaLabel: "기술 리드", question: "기술 질문" },
          updatedQueue: [],
          sessionComplete: false,
        }),
      });
    const { interviewService } = await import("@/lib/interview/interview-service");
    const result = await interviewService.answer("mock-session-id", "내 답변");
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.sessionComplete).toBe(false);
  });
});
