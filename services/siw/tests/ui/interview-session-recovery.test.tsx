import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ sessionId: "test-session" }),
}));

vi.mock("@/components/InterviewChat", () => ({
  default: () => React.createElement("div", { "data-testid": "interview-chat" }),
}));

describe("InterviewSessionPage — 세션 복구", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
  });

  it("sessionStorage에 첫 질문이 없으면 중단 안내가 표시된다", async () => {
    Object.defineProperty(window, "sessionStorage", {
      value: { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn() },
      writable: true,
    });

    const InterviewSessionPage = (
      await import("@/app/(app)/interview/[sessionId]/page")
    ).default;
    render(<InterviewSessionPage />);

    expect(screen.getByTestId("session-interrupted")).toBeInTheDocument();
    expect(screen.getByText("면접이 중단되었습니다")).toBeInTheDocument();
    expect(screen.getByTestId("btn-restart")).toBeInTheDocument();
  });

  it("sessionStorage에 첫 질문이 있으면 중단 안내가 표시되지 않는다", async () => {
    const questionData = JSON.stringify({
      persona: "hr",
      personaLabel: "HR 담당자",
      question: "자기소개",
      type: "main",
    });
    Object.defineProperty(window, "sessionStorage", {
      value: {
        getItem: vi.fn().mockImplementation((key: string) => {
          if (key === "interview-first-test-session") return questionData;
          return null;
        }),
        setItem: vi.fn(),
      },
      writable: true,
    });

    const InterviewSessionPage = (
      await import("@/app/(app)/interview/[sessionId]/page")
    ).default;
    render(<InterviewSessionPage />);

    expect(screen.queryByTestId("session-interrupted")).not.toBeInTheDocument();
  });
});
