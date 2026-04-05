import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks
vi.mock("@/lib/engine-client", () => ({
  engineFetch: vi.fn(),
}));

vi.mock("@/lib/anon-cookie", () => ({
  getAnonId: vi.fn().mockResolvedValue("test-anon-id"),
}));

vi.mock("@/lib/supabase/get-current-user-id", () => ({
  getCurrentUserId: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/credit", () => ({
  awardInterviewCoin: vi.fn().mockResolvedValue({ awarded: true }),
}));

import { engineFetch } from "@/lib/engine-client";
import { getCurrentUserId } from "@/lib/supabase/get-current-user-id";
import { createServiceClient } from "@/lib/supabase/server";
import { awardInterviewCoin } from "@/lib/credit";
import { POST } from "../route";

const mockEngFetch = vi.mocked(engineFetch);
const mockGetCurrentUserId = vi.mocked(getCurrentUserId);
const mockCreateServiceClient = vi.mocked(createServiceClient);
const mockAwardInterviewCoin = vi.mocked(awardInterviewCoin);

const validBody = {
  sessionId: "550e8400-e29b-41d4-a716-446655440000",
  resumeText: "저는 열정적인 개발자입니다.",
  history: Array.from({ length: 5 }, (_, i) => ({
    question: `질문 ${i + 1}`,
    answer: `답변 ${i + 1}`,
    persona: "hr",
    personaLabel: "HR 담당자",
  })),
};

const mockReport = {
  totalScore: 80,
  axisScores: {},
  axisFeedbacks: {},
  summary: "좋은 면접이었습니다.",
};

function makeSupabaseMock() {
  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "report-uuid" },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    }),
  };
}

describe("POST /api/interview/end — 코인 지급", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngFetch.mockResolvedValue({
      ok: true,
      json: async () => mockReport,
    } as Response);
    mockCreateServiceClient.mockReturnValue(
      makeSupabaseMock() as unknown as ReturnType<typeof createServiceClient>
    );
  });

  it("로그인 유저 + report 성공 시 awardInterviewCoin을 호출한다", async () => {
    mockGetCurrentUserId.mockResolvedValue("user-uuid");

    const request = new Request("http://localhost/api/interview/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockAwardInterviewCoin).toHaveBeenCalledWith(
      "user-uuid",
      validBody.sessionId
    );
  });

  it("비로그인 유저 (userId null) 시 awardInterviewCoin을 호출하지 않는다", async () => {
    mockGetCurrentUserId.mockResolvedValue(null);

    const request = new Request("http://localhost/api/interview/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockAwardInterviewCoin).not.toHaveBeenCalled();
  });

  it("awardInterviewCoin 실패해도 report 200을 반환한다 (non-fatal)", async () => {
    mockGetCurrentUserId.mockResolvedValue("user-uuid");
    mockAwardInterviewCoin.mockResolvedValue({ awarded: false, reason: "rpc_error" });

    const request = new Request("http://localhost/api/interview/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.report).toBeDefined();
  });
});
