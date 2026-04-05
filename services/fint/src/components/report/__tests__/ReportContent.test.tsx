import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReportResponse } from "@/lib/types";

// next/navigation mock
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// 하위 컴포넌트 mock — 렌더링 오류 방지
vi.mock("@/components/report/LoadingPhaseText", () => ({
  LoadingPhaseText: () => <span>Loading...</span>,
}));
vi.mock("@/components/report/ScoreBar", () => ({
  ScoreBar: ({ score }: { score: number }) => <div data-testid="score-bar">{score}</div>,
}));
vi.mock("@/components/report/CategoryScoreGrid", () => ({
  CategoryScoreGrid: () => <div />,
}));
vi.mock("@/components/report/FeedbackSection", () => ({
  FeedbackSection: () => <div />,
}));
vi.mock("@/components/report/OrbPreviewCard", () => ({
  OrbPreviewCard: () => <div />,
}));
vi.mock("@/components/layout/TopBar", () => ({
  TopBar: ({ title }: { title: string }) => <header>{title}</header>,
}));
vi.mock("@/components/interview/SaveAccountCTA", () => ({
  SaveAccountCTA: () => <div />,
}));

import { ReportContent } from "../ReportContent";

const mockReport: ReportResponse = {
  totalScore: 85,
  summary: "테스트 요약",
  axisFeedbacks: [],
  growthCurve: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("ReportContent", () => {
  it("renders report when initialReport prop provided", () => {
    render(
      <ReportContent sessionId="test-id" initialReport={mockReport} isOwner={true} />
    );

    expect(screen.getAllByText("85").length).toBeGreaterThan(0);
  });

  it("non-owner view hides exit dialog elements and shows single CTA", () => {
    render(
      <ReportContent sessionId="test-id" initialReport={mockReport} isOwner={false} />
    );

    expect(screen.getByText("나도 면접 연습하기")).toBeInTheDocument();
    expect(screen.queryByText("면접 기록 보기")).not.toBeInTheDocument();
  });

  it("owner view shows full CTA buttons", () => {
    render(
      <ReportContent sessionId="test-id" initialReport={mockReport} isOwner={true} />
    );

    expect(screen.getByText("면접 기록 보기")).toBeInTheDocument();
    expect(screen.getByText("다시 연습하기")).toBeInTheDocument();
  });

  it("falls back to sessionStorage when initialReport is null", async () => {
    sessionStorage.setItem("report_test-id", JSON.stringify(mockReport));

    render(
      <ReportContent sessionId="test-id" initialReport={null} isOwner={true} />
    );

    // useEffect 실행 후 점수가 표시되는지 확인
    expect((await screen.findAllByText("85")).length).toBeGreaterThan(0);
  });
});
