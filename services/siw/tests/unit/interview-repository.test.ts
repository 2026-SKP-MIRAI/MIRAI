import { describe, it, expect, vi, beforeEach } from "vitest";

// repository 내부에서 모듈 레벨로 생성되는 prisma 인스턴스를 가로채기 위해
// PrismaClient 생성자가 반환하는 객체를 고정 mock으로 교체한다.
const mockFindUniqueOrThrow = vi.fn();
const mockUpdate = vi.fn();
const mockCreate = vi.fn();

vi.mock("@prisma/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@prisma/client")>();
  return {
    ...actual,
    PrismaClient: vi.fn().mockImplementation(() => ({
      interviewSession: {
        create: mockCreate,
        findUniqueOrThrow: mockFindUniqueOrThrow,
        update: mockUpdate,
      },
    })),
  };
});

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: vi.fn().mockImplementation(() => ({})),
}));

describe("interviewRepository", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("정상 세션 — questionsQueue/history Zod parse 후 SessionSnapshot 반환", async () => {
      mockFindUniqueOrThrow.mockResolvedValueOnce({
        id: "session-1",
        userId: "user-1",
        resumeText: "이력서",
        currentQuestion: "자기소개를 해주세요.",
        currentPersona: "hr",
        currentQuestionType: "main",
        questionsQueue: [{ persona: "tech_lead", type: "main" }],
        history: [{ persona: "hr", personaLabel: "HR 담당자", question: "Q1", answer: "A1", type: "main" }],
        sessionComplete: false,
        engineResultCache: null,
      });
      const { interviewRepository } = await import("@/lib/interview/interview-repository");
      const result = await interviewRepository.findById("session-1");
      expect(result.id).toBe("session-1");
      expect(result.questionsQueue).toHaveLength(1);
      expect(result.history).toHaveLength(1);
      expect(result.engineResultCache).toBeNull();
    });

    it("currentQuestionType null → 'main' 기본값 처리", async () => {
      mockFindUniqueOrThrow.mockResolvedValueOnce({
        id: "s1", userId: null, resumeText: "r", currentQuestion: "q",
        currentPersona: "hr", currentQuestionType: null,
        questionsQueue: [], history: [], sessionComplete: false, engineResultCache: null,
      });
      const { interviewRepository } = await import("@/lib/interview/interview-repository");
      const result = await interviewRepository.findById("s1");
      expect(result.currentQuestionType).toBe("main");
    });

    it("questionsQueue/history 빈 배열 처리", async () => {
      mockFindUniqueOrThrow.mockResolvedValueOnce({
        id: "s1", userId: null, resumeText: "r", currentQuestion: "q",
        currentPersona: "hr", currentQuestionType: "main",
        questionsQueue: [], history: [], sessionComplete: false, engineResultCache: null,
      });
      const { interviewRepository } = await import("@/lib/interview/interview-repository");
      const result = await interviewRepository.findById("s1");
      expect(result.questionsQueue).toEqual([]);
      expect(result.history).toEqual([]);
    });
  });

  describe("updateAfterAnswer", () => {
    it("P2025 → session_not_found 에러 변환", async () => {
      const { Prisma } = await import("@prisma/client");
      mockUpdate.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Not found", {
          code: "P2025", clientVersion: "5.0.0",
        })
      );
      const { interviewRepository } = await import("@/lib/interview/interview-repository");
      await expect(
        interviewRepository.updateAfterAnswer("nonexistent", {
          history: [], questionsQueue: [], currentQuestion: "",
          currentPersona: "", currentQuestionType: "main",
          sessionComplete: false, engineResultCache: null,
        })
      ).rejects.toThrow("session_not_found");
    });

    it("정상 업데이트 → void 반환", async () => {
      mockUpdate.mockResolvedValueOnce({});
      const { interviewRepository } = await import("@/lib/interview/interview-repository");
      await expect(
        interviewRepository.updateAfterAnswer("session-1", {
          history: [], questionsQueue: [], currentQuestion: "q",
          currentPersona: "hr", currentQuestionType: "main",
          sessionComplete: false, engineResultCache: null,
        })
      ).resolves.toBeUndefined();
    });
  });
});
