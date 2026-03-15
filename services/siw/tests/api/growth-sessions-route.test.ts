import { describe, it, expect, vi } from "vitest";

const baseSession = {
  id: "s1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  reportScores: {
    communication: 80,
    problemSolving: 75,
    logicalThinking: 70,
    jobExpertise: 85,
    cultureFit: 65,
    leadership: 72,
    creativity: 68,
    sincerity: 90,
  },
  reportTotalScore: 76,
};

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
    },
  }),
}));

vi.mock("@/lib/interview/interview-repository", () => ({
  interviewRepository: {
    listCompleted: vi.fn().mockResolvedValue([
      { ...baseSession, id: "s1", resumeText: "A".repeat(35) },
      { ...baseSession, id: "s2", resumeText: "짧은 이력서" },
    ]),
  },
}));

describe("GET /api/growth/sessions", () => {
  it("200: 세션 목록 반환", async () => {
    const { GET } = await import("@/app/api/growth/sessions/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data[0].resumeLabel.endsWith("…")).toBe(true);
  });

  it("200: 빈 배열", async () => {
    const { interviewRepository } = await import(
      "@/lib/interview/interview-repository"
    );
    (interviewRepository.listCompleted as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const { GET } = await import("@/app/api/growth/sessions/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it("resumeLabel: 30자 초과 시 말줄임표", async () => {
    const { interviewRepository } = await import(
      "@/lib/interview/interview-repository"
    );
    (interviewRepository.listCompleted as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { ...baseSession, resumeText: "가".repeat(35) },
    ]);
    const { GET } = await import("@/app/api/growth/sessions/route");
    const res = await GET();
    const data = await res.json();
    expect(data[0].resumeLabel).toHaveLength(31);
    expect(data[0].resumeLabel.endsWith("…")).toBe(true);
  });

  it("500: repository throws", async () => {
    const { interviewRepository } = await import(
      "@/lib/interview/interview-repository"
    );
    (interviewRepository.listCompleted as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("db error")
    );
    const { GET } = await import("@/app/api/growth/sessions/route");
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
