import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFeedbackResponse = {
  score: 85,
  feedback: { good: ["좋음"], improve: ["개선"] },
  keywords: ["리더십"],
  improvedAnswerGuide: "가이드",
  comparisonDelta: null,
};

describe("POST /api/practice/feedback", () => {
  beforeEach(() => {
    vi.resetModules();
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => mockFeedbackResponse,
    } as Response);
  });

  it("200 성공 (previousAnswer 없음)", async () => {
    const { POST } = await import("@/app/api/practice/feedback/route");
    const req = new Request("http://localhost/api/practice/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "자기소개 해주세요.", answer: "저는 ..." }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.score).toBe(85);
    expect(data.comparisonDelta).toBeNull();
  });

  it("200 성공 (previousAnswer 있음, comparisonDelta 포함)", async () => {
    const responseWithDelta = {
      ...mockFeedbackResponse,
      comparisonDelta: { scoreDelta: 10, improvements: ["더 좋아짐"] },
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => responseWithDelta,
    } as Response);

    const { POST } = await import("@/app/api/practice/feedback/route");
    const req = new Request("http://localhost/api/practice/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "자기소개 해주세요.",
        answer: "저는 더 나아졌습니다.",
        previousAnswer: "저는 ...",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.comparisonDelta).toEqual({ scoreDelta: 10, improvements: ["더 좋아짐"] });
  });

  it("400 bad input", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: async () => ({ detail: "질문과 답변은 필수입니다." }),
    } as Response);

    const { POST } = await import("@/app/api/practice/feedback/route");
    const req = new Request("http://localhost/api/practice/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "", answer: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toBe("질문과 답변은 필수입니다.");
  });

  it("500 engine error", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("fetch failed"));

    const { POST } = await import("@/app/api/practice/feedback/route");
    const req = new Request("http://localhost/api/practice/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "자기소개 해주세요.", answer: "저는 ..." }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.message).toBe("피드백 생성에 실패했습니다.");
  });

  it("첫 답변: previousScore 없이 요청 → 엔진에 previousScore 미전달", async () => {
    const { POST } = await import("@/app/api/practice/feedback/route");
    const req = new Request("http://localhost/api/practice/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "자기소개 해주세요.",
        answer: "저는 개발자입니다.",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.comparisonDelta).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/practice/feedback"),
      expect.objectContaining({
        body: expect.not.stringContaining("previousScore"),
      })
    );
  });

  it("재답변: previousScore=85 포함 요청 → 엔진에 previousScore 전달", async () => {
    const responseWithDelta = {
      score: 88,
      feedback: { good: ["개선됨"], improve: [] },
      keywords: ["리더십"],
      improvedAnswerGuide: "가이드",
      comparisonDelta: { scoreDelta: 3, improvements: ["논리 구조 강화"] },
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => responseWithDelta,
    } as Response);

    const { POST } = await import("@/app/api/practice/feedback/route");
    const req = new Request("http://localhost/api/practice/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "자기소개 해주세요.",
        answer: "저는 더 발전했습니다.",
        previousAnswer: "저는 개발자입니다.",
        previousScore: 85,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.comparisonDelta).toEqual({
      scoreDelta: 3,
      improvements: ["논리 구조 강화"],
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/practice/feedback"),
      expect.objectContaining({
        body: expect.stringContaining('"previousScore":85'),
      })
    );
  });
});
