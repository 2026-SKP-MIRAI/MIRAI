import { describe, it, expect, vi } from "vitest";

vi.mock("@prisma/client", () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      constructor(message: string, { code }: { code: string; clientVersion: string }) {
        super(message);
        this.code = code;
      }
    },
  },
}));

vi.mock("@/lib/interview/interview-repository", () => ({
  interviewRepository: {
    complete: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("PATCH /api/interview/[sessionId]/complete", () => {
  it("200: 정상 종료", async () => {
    const { PATCH } = await import(
      "@/app/api/interview/[sessionId]/complete/route"
    );
    const req = new Request(
      "http://localhost/api/interview/session-abc/complete",
      { method: "PATCH" }
    );
    const res = await PATCH(req, { params: { sessionId: "session-abc" } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("404: 세션 없음", async () => {
    const { interviewRepository } = await import(
      "@/lib/interview/interview-repository"
    );
    (interviewRepository.complete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("session_not_found")
    );
    const { PATCH } = await import(
      "@/app/api/interview/[sessionId]/complete/route"
    );
    const req = new Request(
      "http://localhost/api/interview/missing-session/complete",
      { method: "PATCH" }
    );
    const res = await PATCH(req, { params: { sessionId: "missing-session" } });
    expect(res.status).toBe(404);
  });

  it("멱등성: 이미 완료된 세션 재호출", async () => {
    const { interviewRepository } = await import(
      "@/lib/interview/interview-repository"
    );
    (interviewRepository.complete as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      undefined
    );
    const { PATCH } = await import(
      "@/app/api/interview/[sessionId]/complete/route"
    );
    const req = new Request(
      "http://localhost/api/interview/session-abc/complete",
      { method: "PATCH" }
    );
    const res = await PATCH(req, { params: { sessionId: "session-abc" } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("500: 기타 오류", async () => {
    const { interviewRepository } = await import(
      "@/lib/interview/interview-repository"
    );
    (interviewRepository.complete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("unexpected error")
    );
    const { PATCH } = await import(
      "@/app/api/interview/[sessionId]/complete/route"
    );
    const req = new Request(
      "http://localhost/api/interview/session-abc/complete",
      { method: "PATCH" }
    );
    const res = await PATCH(req, { params: { sessionId: "session-abc" } });
    expect(res.status).toBe(500);
  });
});
