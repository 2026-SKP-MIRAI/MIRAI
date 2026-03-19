import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock event-logger — call through so fn executes
vi.mock("@/lib/observability/event-logger", () => ({
  withEventLogging: vi.fn(async (_ft: string, _sid: string | null, fn: (meta: { retry_count: number }) => Promise<unknown>) =>
    fn({ retry_count: 0 })
  ),
}));

vi.mock("@/lib/interview/interview-repository", () => ({
  interviewRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    saveEngineResult: vi.fn(),
    updateAfterAnswer: vi.fn(),
  },
}));

vi.mock("@/lib/resume-repository", () => ({
  resumeRepository: {
    findById: vi.fn(),
  },
}));

import { withEventLogging } from "@/lib/observability/event-logger";
import { interviewRepository } from "@/lib/interview/interview-repository";
import { resumeRepository } from "@/lib/resume-repository";
import { interviewService } from "@/lib/interview/interview-service";

const mockWithEventLogging = vi.mocked(withEventLogging);
const mockInterviewRepository = vi.mocked(interviewRepository);
const mockResumeRepository = vi.mocked(resumeRepository);

const ENGINE_START_RESPONSE = {
  firstQuestion: {
    persona: "hr" as const,
    personaLabel: "HR 담당자",
    question: "자기소개 해주세요",
    type: "main" as const,
  },
  questionsQueue: [],
};

const ENGINE_ANSWER_RESPONSE = {
  nextQuestion: {
    persona: "tech_lead" as const,
    personaLabel: "기술 리드",
    question: "기술 스택 설명해주세요",
    type: "main" as const,
  },
  updatedQueue: [],
  sessionComplete: false,
};

beforeEach(() => {
  vi.clearAllMocks();

  // Restore call-through behavior after clearAllMocks
  mockWithEventLogging.mockImplementation(async (_ft, _sid, fn) => fn({ retry_count: 0 }));
});

describe("api-instrumentation: withEventLogging call sites", () => {
  // ST-1: interviewService.start() → feature_type="interview_start", sessionId=null
  it("ST-1: start() calls withEventLogging with feature_type=interview_start, sessionId=null", async () => {
    mockResumeRepository.findById.mockResolvedValue({
      id: "resume-1",
      userId: "user-1",
      fileName: "resume.pdf",
      storageKey: "key/resume.pdf",
      resumeText: "경력 10년 개발자",
      questions: [],
      createdAt: new Date(),
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ENGINE_START_RESPONSE,
    }));

    mockInterviewRepository.create.mockResolvedValue("session-new");

    await interviewService.start("resume-1", ["hr"], "user-1");

    expect(mockWithEventLogging).toHaveBeenCalledWith(
      "interview_start",
      null,
      expect.any(Function),
    );
  });

  // ST-2: interviewService.answer() cache miss → feature_type="interview_answer", sessionId="session-id"
  it("ST-2: answer() cache miss calls withEventLogging with feature_type=interview_answer, sessionId=session-id", async () => {
    mockInterviewRepository.findById.mockResolvedValue({
      id: "session-id",
      userId: "user-1",
      resumeText: "경력 10년 개발자",
      currentQuestion: "자기소개 해주세요",
      currentPersona: "hr",
      currentQuestionType: "main",
      questionsQueue: [],
      history: [],
      sessionComplete: false,
      engineResultCache: null,
      reportJson: null,
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ENGINE_ANSWER_RESPONSE,
    }));

    mockInterviewRepository.saveEngineResult.mockResolvedValue(undefined);
    mockInterviewRepository.updateAfterAnswer.mockResolvedValue(undefined);

    await interviewService.answer("session-id", "저는 10년차 개발자입니다");

    expect(mockWithEventLogging).toHaveBeenCalledWith(
      "interview_answer",
      "session-id",
      expect.any(Function),
    );
  });

  // ST-3: interviewService.followup() → feature_type="interview_followup"
  it("ST-3: followup() calls withEventLogging with feature_type=interview_followup", async () => {
    mockInterviewRepository.findById.mockResolvedValue({
      id: "session-id",
      userId: "user-1",
      resumeText: "경력 10년 개발자",
      currentQuestion: "자기소개 해주세요",
      currentPersona: "hr",
      currentQuestionType: "main",
      questionsQueue: [],
      history: [],
      sessionComplete: false,
      engineResultCache: null,
      reportJson: null,
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ followupQuestion: "더 자세히 설명해주세요" }),
    }));

    await interviewService.followup("session-id", "자기소개 해주세요", "저는 개발자입니다", "hr");

    expect(mockWithEventLogging).toHaveBeenCalledWith(
      "interview_followup",
      "session-id",
      expect.any(Function),
    );
  });
});
