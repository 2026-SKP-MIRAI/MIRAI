import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("chart.js", () => ({
  Chart: { register: vi.fn() },
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  BarElement: {},
  RadialLinearScale: {},
  Filler: {},
  Tooltip: {},
  Legend: {},
}));
vi.mock("react-chartjs-2", () => ({
  Line: () => null,
  Bar: () => null,
  Radar: () => null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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

describe("GrowthPage", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSessions,
    } as Response);
  });

  it("성장 추이 heading 렌더링", async () => {
    const GrowthPage = (await import("@/app/(app)/growth/page")).default;
    render(<GrowthPage />);
    await waitFor(() => {
      expect(screen.getByText("성장 추이")).toBeInTheDocument();
    });
  });

  it("세션 목록 렌더링", async () => {
    const GrowthPage = (await import("@/app/(app)/growth/page")).default;
    render(<GrowthPage />);
    await waitFor(() => {
      expect(screen.getByText("테스트 이력서 A")).toBeInTheDocument();
    });
  });

  it("빈 상태 메시지 — fetch 빈 배열", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
    const GrowthPage = (await import("@/app/(app)/growth/page")).default;
    render(<GrowthPage />);
    await waitFor(() => {
      expect(screen.getByText(/면접을 완료/)).toBeInTheDocument();
    });
  });
});
