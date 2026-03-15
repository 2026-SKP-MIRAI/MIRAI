import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ sessionId: "test-session" }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentProps<"div">) =>
      React.createElement("div", props, children),
    button: ({ children, ...props }: React.ComponentProps<"button">) =>
      React.createElement("button", props, children),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/InterviewChat", () => ({
  default: () => React.createElement("div", { "data-testid": "interview-chat" }),
}));

describe("InterviewSessionPage", () => {
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

  it("면접 종료 버튼 렌더링", async () => {
    const InterviewSessionPage = (
      await import("@/app/(app)/interview/[sessionId]/page")
    ).default;
    render(<InterviewSessionPage />);
    expect(screen.getByText("면접 종료")).toBeInTheDocument();
  });

  it("모달 렌더링 확인 가능 — 종료 버튼 존재", async () => {
    const InterviewSessionPage = (
      await import("@/app/(app)/interview/[sessionId]/page")
    ).default;
    render(<InterviewSessionPage />);
    expect(screen.getByText("면접 종료")).toBeInTheDocument();
  });
});
