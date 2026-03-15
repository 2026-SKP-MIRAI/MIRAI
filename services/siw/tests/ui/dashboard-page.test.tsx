import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowser: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { email: "test@example.com", user_metadata: { full_name: "테스트유저" } } },
      }),
    },
  }),
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

const mockSessions = [
  {
    id: "s1",
    createdAt: "2026-01-01T00:00:00.000Z",
    reportTotalScore: 76,
    scores: {
      communication: 80,
      problemSolving: 75,
      logicalThinking: 70,
      jobExpertise: 85,
      cultureFit: 65,
      leadership: 72,
      creativity: 68,
      sincerity: 90,
    },
    resumeLabel: "테스트 이력서 A",
  },
  {
    id: "s2",
    createdAt: "2026-01-15T00:00:00.000Z",
    reportTotalScore: 82,
    scores: {
      communication: 85,
      problemSolving: 80,
      logicalThinking: 75,
      jobExpertise: 88,
      cultureFit: 70,
      leadership: 78,
      creativity: 72,
      sincerity: 92,
    },
    resumeLabel: "테스트 이력서 B",
  },
];

const mockResumes = [
  {
    id: "r1",
    fileName: "이력서1.pdf",
    extractedLength: 1000,
    uploadedAt: "2026-01-01T00:00:00.000Z",
    previewText: "안녕하세요",
  },
];

describe("DashboardPage", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("growth")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockSessions,
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockResumes,
      } as Response);
    });
  });

  it("대시보드 heading 렌더링", async () => {
    const DashboardPage = (await import("@/app/(app)/dashboard/page")).default;
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/안녕하세요/)).toBeInTheDocument();
    });
  });

  it("세션 데이터 로드 후 렌더링", async () => {
    const DashboardPage = (await import("@/app/(app)/dashboard/page")).default;
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("76")).toBeInTheDocument();
    });
  });

  it("빈 상태 — 빈 배열 반환 시", async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => [],
      } as Response)
    );
    const DashboardPage = (await import("@/app/(app)/dashboard/page")).default;
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/안녕하세요/)).toBeInTheDocument();
    });
  });
});
