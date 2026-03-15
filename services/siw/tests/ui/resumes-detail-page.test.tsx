import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: "r1" }),
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

vi.mock("lucide-react", () => ({
  ChevronLeft: () => React.createElement("span", {}, "<"),
}));

describe("ResumeDetailPage", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "r1",
        fileName: "이력서1.pdf",
        uploadedAt: "2026-01-01T00:00:00.000Z",
        resumeText: "안녕하세요 저는 개발자입니다.",
        questionCount: 5,
        categories: ["기술", "경험"],
      }),
    } as Response);
  });

  it("이력서 상세 페이지 렌더링", async () => {
    const ResumeDetailPage = (
      await import("@/app/(app)/resumes/[id]/page")
    ).default;
    render(<ResumeDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("이력서1.pdf")).toBeInTheDocument();
    });
  });

  it("8축 역량 평가 준비 중 표시", async () => {
    const ResumeDetailPage = (
      await import("@/app/(app)/resumes/[id]/page")
    ).default;
    render(<ResumeDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("준비 중")).toBeInTheDocument();
    });
  });
});
