import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";

vi.mock("chart.js", () => ({
  Chart: class { static register = vi.fn(); },
  CategoryScale: class {},
  LinearScale: class {},
  BarElement: class {},
  BarController: class {},
  PointElement: class {},
  LineElement: class {},
  LineController: class {},
  ArcElement: class {},
  Title: class {},
  Tooltip: class {},
  Legend: class {},
}));

vi.mock("react-chartjs-2", () => ({
  Bar: () => <div data-testid="bar-chart" />,
  Line: () => <div data-testid="line-chart" />,
  Doughnut: () => <div data-testid="doughnut-chart" />,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const mockData = {
  rows: [
    {
      date: "2026-03-19",
      featureType: "interview_start",
      callCount: 42,
      avgLatencyMs: 320,
      errorCount: 1,
      errorRate: 0.02,
    },
  ],
  summary: {
    totalCalls: 42,
    avgLatency: 320,
    avgErrorRate: 0.02,
    featureTypes: ["interview_start"],
    lastUpdated: "2026-03-19",
    totalTokens: 12500,
    totalCostUsd: 0.0025,
  },
};

describe("ObservabilityPage", () => {
  beforeEach(() => {
    vi.resetModules();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    } as Response);
  });

  it("로딩 상태: skeleton 요소 렌더링 확인", async () => {
    let resolveFetch!: (v: unknown) => void;
    global.fetch = vi.fn().mockReturnValue(
      new Promise((resolve) => { resolveFetch = resolve; })
    );
    const ObservabilityPage = (await import("@/app/(app)/dashboard/observability/ObservabilityDashboard")).default;
    render(<ObservabilityPage />);
    // skeleton divs rendered while loading
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
    // resolve to avoid hanging
    resolveFetch({ ok: true, status: 200, json: async () => mockData });
  });

  it("정상 데이터 → stat 카드: 3개 카드 + 숫자 표시", async () => {
    const ObservabilityPage = (await import("@/app/(app)/dashboard/observability/ObservabilityDashboard")).default;
    render(<ObservabilityPage />);
    await waitFor(() => {
      expect(screen.getByText("총 AI 호출 횟수")).toBeInTheDocument();
      expect(screen.getByText("평균 응답 시간")).toBeInTheDocument();
      expect(screen.getByText("예상 AI 비용")).toBeInTheDocument();
      expect(screen.getByText("42")).toBeInTheDocument();
    });
  });

  it("정상 데이터 → 차트: bar-chart, line-chart 존재", async () => {
    const ObservabilityPage = (await import("@/app/(app)/dashboard/observability/ObservabilityDashboard")).default;
    render(<ObservabilityPage />);
    await waitFor(() => {
      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
      expect(screen.getAllByTestId("line-chart").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("빈 데이터: '아직 데이터가 없습니다' 텍스트 포함", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ rows: [], summary: { totalCalls: 0, avgLatency: 0, avgErrorRate: 0, featureTypes: [], lastUpdated: null } }),
    } as Response);
    const ObservabilityPage = (await import("@/app/(app)/dashboard/observability/ObservabilityDashboard")).default;
    render(<ObservabilityPage />);
    await waitFor(() => {
      expect(screen.getByText(/아직 데이터가 없습니다/)).toBeInTheDocument();
    });
  });

  it("기간 필터: '7일' 버튼 클릭 → fetch가 days=7로 재호출됨", async () => {
    const ObservabilityPage = (await import("@/app/(app)/dashboard/observability/ObservabilityDashboard")).default;
    render(<ObservabilityPage />);
    await waitFor(() => {
      expect(screen.getByText("총 AI 호출 횟수")).toBeInTheDocument();
    });
    const btn7 = screen.getByText("최근 7일");
    fireEvent.click(btn7);
    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const has7Days = calls.some((args: unknown[]) => (args[0] as string).includes("days=7"));
      expect(has7Days).toBe(true);
    });
  });
});
