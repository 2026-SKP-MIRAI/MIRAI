import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ sessionId: "test-session" }),
}));

vi.mock("@/components/InterviewChat", () => ({
  default: () => React.createElement("div", { "data-testid": "interview-chat" }),
}));

describe("InterviewSessionPage — 글자 수 카운터", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionId: "test-session",
        currentQuestion: {
          persona: "hr",
          personaLabel: "HR 담당자",
          question: "자기소개",
          type: "main",
        },
        history: [],
        sessionComplete: false,
        updatedQueue: [],
      }),
    } as Response);
    Object.defineProperty(window, "sessionStorage", {
      value: { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn() },
      writable: true,
    });
  });

  it("글자 수 카운터가 표시된다", async () => {
    const InterviewSessionPage = (
      await import("@/app/(app)/interview/[sessionId]/page")
    ).default;
    render(<InterviewSessionPage />);

    const counter = screen.getByTestId("char-count");
    expect(counter).toHaveTextContent("0 / 5000");
  });

  it("입력 시 글자 수가 업데이트된다", async () => {
    const InterviewSessionPage = (
      await import("@/app/(app)/interview/[sessionId]/page")
    ).default;
    render(<InterviewSessionPage />);

    const textarea = screen.getByTestId("answer-input");
    fireEvent.change(textarea, { target: { value: "테스트 답변" } });

    const counter = screen.getByTestId("char-count");
    expect(counter).toHaveTextContent("6 / 5000");
  });

  it("5000자 초과 시 경고 문구가 표시된다", async () => {
    const InterviewSessionPage = (
      await import("@/app/(app)/interview/[sessionId]/page")
    ).default;
    render(<InterviewSessionPage />);

    const textarea = screen.getByTestId("answer-input");
    const longText = "가".repeat(5001);
    fireEvent.change(textarea, { target: { value: longText } });

    expect(screen.getByTestId("char-warning")).toHaveTextContent(
      "5000자를 초과한 내용은 저장되지 않습니다"
    );
  });

  it("5000자 이하일 때 경고 문구가 표시되지 않는다", async () => {
    const InterviewSessionPage = (
      await import("@/app/(app)/interview/[sessionId]/page")
    ).default;
    render(<InterviewSessionPage />);

    const textarea = screen.getByTestId("answer-input");
    fireEvent.change(textarea, { target: { value: "가".repeat(5000) } });

    expect(screen.queryByTestId("char-warning")).not.toBeInTheDocument();
  });
});
