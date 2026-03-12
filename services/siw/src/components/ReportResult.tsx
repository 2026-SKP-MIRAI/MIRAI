"use client";

import React from "react";
import type { ReportResponse, AxisFeedback } from "@/lib/types";

const AXIS_LABELS: Record<string, string> = {
  communication: "의사소통",
  problemSolving: "문제해결",
  logicalThinking: "논리적 사고",
  jobExpertise: "직무 전문성",
  cultureFit: "조직 적합성",
  leadership: "리더십",
  creativity: "창의성",
  sincerity: "성실성",
};

function getScoreColor(type: AxisFeedback["type"]): string {
  return type === "strength" ? "#10B981" : "#7C3AED";
}

function getBarStyle(type: AxisFeedback["type"], score: number): React.CSSProperties {
  if (type === "strength") {
    return { background: "linear-gradient(90deg, #10B981, #34D399)", width: `${score}%` };
  }
  return { background: "linear-gradient(90deg, #7C3AED, #9B59E8)", width: `${score}%` };
}

interface Props {
  report: ReportResponse;
}

export default function ReportResult({ report }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="glass-card rounded-2xl p-6 text-center">
        <p className="text-sm text-[#9CA3AF] mb-1">종합 점수</p>
        <p className="text-5xl font-bold gradient-text mb-3">{report.totalScore}</p>
        <p className="text-sm text-[#6B7280]">{report.summary}</p>
      </div>

      <div className="score-grid-wrapper">
        {report.axisFeedbacks.map((item) => {
          const scoreColor = getScoreColor(item.type);
          const barStyle = getBarStyle(item.type, item.score);
          const label = AXIS_LABELS[item.axis] ?? item.axisLabel;

          return (
            <div key={item.axis} className="axis-row">
              <div className="axis-row__header">
                <div className="axis-row__meta">
                  <span className="axis-row__name">{label}</span>
                </div>
                <div className="axis-row__scores">
                  <span className="axis-row__current-score" style={{ color: scoreColor }}>
                    {item.score}점
                  </span>
                </div>
              </div>

              <div className="axis-row__track">
                <div className="axis-row__bar-current" style={barStyle} aria-hidden="true" />
              </div>

              <p className="axis-row__desc">{item.feedback}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
