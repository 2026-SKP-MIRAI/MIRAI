import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useInterview } from "../useInterview";

// fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

// sessionStorage mock
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, "sessionStorage", { value: sessionStorageMock });

describe("useInterview", () => {
  beforeEach(() => {
    sessionStorageMock.clear();
    mockFetch.mockReset();
    // interview_init 설정
    sessionStorageMock.setItem("interview_init", JSON.stringify({
      sessionId: "test-session-123",
      firstQuestion: { question: "자기소개를 해주세요.", persona: "hr" },
      questionsQueue: [
        { question: "지원 동기는?", persona: "tech_lead", type: "main" },
      ],
      resumeText: "직군: IT / 취준 단계: 면접 준비 중",
    }));
  });

  it("sessionStorage에서 초기 상태를 복구한다", () => {
    const { result } = renderHook(() => useInterview({ sessionId: "test-session-123" }));
    expect(result.current.state.currentQuestion).toBe("자기소개를 해주세요.");
    expect(result.current.state.currentPersona).toBe("hr");
    expect(result.current.state.status).toBe("answering");
  });

  it("sendAnswer가 API를 호출하고 history를 누적한다", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nextQuestion: { question: "지원 동기는?", persona: "tech_lead" },
        updatedQueue: [],
        sessionComplete: false,
      }),
    });

    const { result } = renderHook(() => useInterview({ sessionId: "test-session-123" }));

    await act(async () => {
      await result.current.sendAnswer("안녕하세요. 저는 3년차 개발자입니다.");
    });

    await waitFor(() => {
      expect(result.current.state.history).toHaveLength(1);
      expect(result.current.state.history[0].answer).toBe("안녕하세요. 저는 3년차 개발자입니다.");
      expect(result.current.state.history[0].question).toBe("자기소개를 해주세요.");
    });
  });

  it("sessionComplete: true 시 status가 ending으로 변경된다", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nextQuestion: null,
        updatedQueue: [],
        sessionComplete: true,
      }),
    });

    const { result } = renderHook(() => useInterview({ sessionId: "test-session-123" }));

    await act(async () => {
      await result.current.sendAnswer("마지막 답변");
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("ending");
    });
  });

  it("API 오류 시 status가 error가 된다", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "서버 오류" }),
    });

    const { result } = renderHook(() => useInterview({ sessionId: "test-session-123" }));

    await act(async () => {
      await result.current.sendAnswer("답변");
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("error");
    });
  });

  it("resetError가 status를 answering으로 복구한다", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "오류" }),
    });

    const { result } = renderHook(() => useInterview({ sessionId: "test-session-123" }));

    await act(async () => {
      await result.current.sendAnswer("답변");
    });

    await waitFor(() => expect(result.current.state.status).toBe("error"));

    act(() => result.current.resetError());
    expect(result.current.state.status).toBe("answering");
  });
});
