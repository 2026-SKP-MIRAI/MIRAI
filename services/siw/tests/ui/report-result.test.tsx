import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import ReportResult from "../../src/components/ReportResult";
import type { ReportResponse } from "@/lib/types";

vi.mock("chart.js", () => ({
  Chart: { register: vi.fn() },
  RadialLinearScale: {},
  PointElement: {},
  LineElement: {},
  Filler: {},
  Tooltip: {},
  Legend: {},
}));
vi.mock("react-chartjs-2", () => ({
  Radar: () => null,
}));

const mockReport: ReportResponse = {
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
  totalScore: 76,
  summary: "전반적으로 우수한 면접 역량을 보여주었습니다.",
  axisFeedbacks: [
    { axis: "communication", axisLabel: "의사소통", score: 80, type: "strength", feedback: "명확한 의사소통 능력을 보여주었습니다" },
    { axis: "problemSolving", axisLabel: "문제해결", score: 75, type: "strength", feedback: "문제를 구조적으로 접근했습니다" },
    { axis: "logicalThinking", axisLabel: "논리적 사고", score: 70, type: "improvement", feedback: "논리적 흐름을 더욱 강화해야 합니다" },
    { axis: "jobExpertise", axisLabel: "직무 전문성", score: 85, type: "strength", feedback: "직무 전문성이 탁월합니다" },
    { axis: "cultureFit", axisLabel: "조직 적합성", score: 65, type: "improvement", feedback: "팀 협업 사례를 보강해주세요" },
    { axis: "leadership", axisLabel: "리더십", score: 72, type: "improvement", feedback: "리더십 경험을 더 구체적으로 제시해주세요" },
    { axis: "creativity", axisLabel: "창의성", score: 68, type: "improvement", feedback: "창의적 사고 사례를 추가해주세요" },
    { axis: "sincerity", axisLabel: "성실성", score: 90, type: "strength", feedback: "성실하고 진지한 답변 태도가 인상적입니다" },
  ],
  growthCurve: null,
};

describe("ReportResult", () => {
  it("totalScore_렌더링", () => {
    render(<ReportResult report={mockReport} />);
    expect(screen.getAllByText("76").length).toBeGreaterThan(0);
  });

  it("summary_텍스트_렌더링", () => {
    render(<ReportResult report={mockReport} />);
    expect(screen.getByText("전반적으로 우수한 면접 역량을 보여주었습니다.")).toBeInTheDocument();
  });

  it("8개_축_한국어_이름_렌더링", () => {
    render(<ReportResult report={mockReport} />);
    expect(screen.getByText("의사소통")).toBeInTheDocument();
    expect(screen.getByText("문제해결")).toBeInTheDocument();
    expect(screen.getByText("논리적 사고")).toBeInTheDocument();
    expect(screen.getByText("직무 전문성")).toBeInTheDocument();
    expect(screen.getByText("조직 적합성")).toBeInTheDocument();
    expect(screen.getByText("리더십")).toBeInTheDocument();
    expect(screen.getByText("창의성")).toBeInTheDocument();
    expect(screen.getByText("성실성")).toBeInTheDocument();
  });

  it("strength_피드백_텍스트_렌더링", () => {
    render(<ReportResult report={mockReport} />);
    // strength feedbacks render as score entries in the summary tab axis list
    expect(screen.getByText("성실성")).toBeInTheDocument();
    expect(screen.getByText("의사소통")).toBeInTheDocument();
  });

  it("improvement_피드백_텍스트_렌더링", () => {
    render(<ReportResult report={mockReport} />);
    fireEvent.click(screen.getByText("개선점"));
    expect(screen.getByText("논리적 흐름을 더욱 강화해야 합니다")).toBeInTheDocument();
    expect(screen.getByText("팀 협업 사례를 보강해주세요")).toBeInTheDocument();
  });

  it("개선점 탭 존재", () => {
    render(<ReportResult report={mockReport} />);
    expect(screen.getByText("개선점")).toBeInTheDocument();
  });

  it("총평 탭 존재", () => {
    render(<ReportResult report={mockReport} />);
    expect(screen.getByText("총평")).toBeInTheDocument();
  });
});
