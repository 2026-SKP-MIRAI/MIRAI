import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
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

describe("InterviewNewPage", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
  });

  it("페이지 렌더링 — 면접 시작 heading 존재", async () => {
    const InterviewNewPage = (await import("@/app/(app)/interview/new/page")).default;
    render(<InterviewNewPage />);
    expect(screen.getByText("면접 시작하기")).toBeInTheDocument();
  });

  it("fetch 완료 전 로딩 상태 — 크래시 없음", async () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    const InterviewNewPage = (await import("@/app/(app)/interview/new/page")).default;
    expect(() => render(<InterviewNewPage />)).not.toThrow();
  });
});
