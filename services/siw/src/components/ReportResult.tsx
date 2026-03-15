"use client";

import React, { useState, useCallback } from "react";
import type { ReportResponse } from "@/lib/types";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Radar } from "react-chartjs-2";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

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

function getGrade(score: number): { label: string } {
  if (score >= 85) return { label: "A 등급" };
  if (score >= 70) return { label: "B 등급" };
  if (score >= 55) return { label: "C 등급" };
  return { label: "D 등급" };
}

function getBarStyle(score: number): React.CSSProperties {
  if (score >= 85) return { background: "linear-gradient(90deg, #10B981, #34D399)", width: `${score}%` };
  if (score >= 65) return { background: "linear-gradient(90deg, #7C3AED, #9B59E8)", width: `${score}%` };
  return { background: "linear-gradient(90deg, #F59E0B, #FCD34D)", width: `${score}%` };
}

function getScoreColor(score: number): string {
  if (score >= 85) return "#10B981";
  if (score >= 65) return "#7C3AED";
  return "#F59E0B";
}

interface Props {
  report: ReportResponse;
}

export default function ReportResult({ report }: Props) {
  const [activeTab, setActiveTab] = useState<"summary" | "improvements">("summary");
  const [activeAxis, setActiveAxis] = useState<string | null>(null);
  const [expandedAxis, setExpandedAxis] = useState<string | null>(null);

  const handleEnter = useCallback((axis: string) => setActiveAxis(axis), []);
  const handleLeave = useCallback(() => setActiveAxis(null), []);
  const handleClick = useCallback((axis: string) => {
    setExpandedAxis(prev => prev === axis ? null : axis);
  }, []);

  const grade = getGrade(report.totalScore);

  const axisKeys = Object.keys(AXIS_LABELS) as (keyof typeof AXIS_LABELS)[];
  const radarData = {
    labels: axisKeys.map((k) => AXIS_LABELS[k]),
    datasets: [
      {
        label: "8축 점수",
        data: axisKeys.map((k) => (report.scores as Record<string, number>)[k] ?? 0),
        backgroundColor: "rgba(124,58,237,0.15)",
        borderColor: "#7C3AED",
        borderWidth: 2,
        pointBackgroundColor: "#7C3AED",
        pointBorderColor: "white",
        pointBorderWidth: 2,
        pointRadius: 4,
      },
    ],
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { display: false } },
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 20,
          font: { size: 9 },
          color: "#9CA3AF" as const,
          backdropColor: "transparent" as const,
        },
        grid: { color: "rgba(0,0,0,0.07)" },
        angleLines: { color: "rgba(0,0,0,0.07)" },
        pointLabels: { font: { size: 13, weight: 600 }, color: "#374151" as const },
      },
    },
  };

  const improvements = report.axisFeedbacks.filter((f) => f.type === "improvement").slice(0, 5);
  const strengths = report.axisFeedbacks.filter((f) => f.type === "strength").slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      {/* 종합 점수 카드 */}
      <div className="rounded-2xl p-8 text-center text-white" style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}>
        <div
          className="inline-block rounded-full px-4 py-1 text-sm font-bold mb-3"
          style={{ background: "rgba(255,255,255,0.2)", border: "1.5px solid rgba(255,255,255,0.4)" }}
        >
          {grade.label}
        </div>
        <p className="font-black leading-none mb-1" style={{ fontSize: "80px", letterSpacing: "-3px" }}>
          {report.totalScore}
        </p>
        <p className="text-base opacity-85">/ 100점</p>
        <p className="text-sm opacity-75 mt-2">총 {report.axisFeedbacks.length}개 항목 평가 완료</p>
      </div>

      {/* 내부 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(["summary", "improvements"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === tab
                ? "bg-white text-violet-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "summary" ? "총평" : "개선점"}
          </button>
        ))}
      </div>

      {/* 총평 탭 */}
      {activeTab === "summary" && (
        <div className="flex flex-col gap-4">
          <div className="bg-white/90 backdrop-blur-sm border border-black/[0.08] rounded-2xl p-8">
            <div className="grid grid-cols-2 gap-10 items-start">
              {/* 레이더 차트 */}
              <div>
                <p className="text-sm font-semibold text-gray-500 mb-4 text-center">8축 역량 레이더</p>
                <div className="max-w-[420px] mx-auto">
                  <Radar data={radarData} options={radarOptions} />
                </div>
              </div>
              {/* 8축 점수 바 */}
              <div
                className={`score-grid-wrapper${activeAxis !== null ? " score-grid-hovered" : ""}`}
                onMouseLeave={handleLeave}
              >
                <div className="score-grid__summary">
                  <span className="score-grid__summary-label">종합 점수</span>
                  <div className="score-grid__summary-values">
                    <span className="score-grid__summary-current">{report.totalScore}</span>
                    <span className="score-grid__summary-label" style={{ marginLeft: 4 }}>/ 100</span>
                  </div>
                </div>
                <div className="score-grid__divider" />
                <div className="score-grid__list">
                  {report.axisFeedbacks.map((item) => {
                    const label = AXIS_LABELS[item.axis] ?? item.axisLabel;
                    const scoreColor = getScoreColor(item.score);
                    return (
                      <div
                        key={item.axis}
                        className="axis-row cursor-pointer"
                        data-active={activeAxis === item.axis}
                        data-inactive={activeAxis !== null && activeAxis !== item.axis}
                        onMouseEnter={() => handleEnter(item.axis)}
                        onMouseLeave={handleLeave}
                        onClick={() => handleClick(item.axis)}
                      >
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
                          <div className="axis-row__bar-current" style={getBarStyle(item.score)} aria-hidden="true" />
                        </div>
                        <p
                          className="axis-row__desc"
                          style={expandedAxis === item.axis
                            ? { opacity: 1, maxHeight: "none", overflow: "visible", WebkitLineClamp: "unset" }
                            : { WebkitLineClamp: 1, display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden" }
                          }
                        >
                          {item.feedback}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* AI 피드백 */}
          <div className="bg-gray-50 rounded-xl p-5 border border-black/5">
            <p className="text-sm font-semibold text-gray-700 mb-2">AI 면접관 종합 피드백</p>
            <p className="text-sm text-gray-600 leading-[1.8]">{report.summary}</p>
          </div>
        </div>
      )}

      {/* 개선점 탭 */}
      {activeTab === "improvements" && (
        <div className="flex flex-col gap-5">
          {/* 강점 섹션 */}
          {strengths.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-emerald-600 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                잘한 점
              </p>
              {strengths.map((item, idx) => {
                const label = AXIS_LABELS[item.axis] ?? item.axisLabel;
                return (
                  <div key={item.axis} className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="inline-flex items-center justify-center w-6 h-6 rounded-md text-white text-xs font-bold shrink-0"
                        style={{ background: "linear-gradient(135deg, #10B981, #34D399)" }}
                      >
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-sm text-gray-900">{label}</span>
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800">{item.score}점</span>
                    </div>
                    <p className="text-sm text-gray-600 leading-[1.7]">{item.feedback}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* 개선점 섹션 */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-amber-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              개선할 점
            </p>
            {improvements.length === 0 ? (
              <div className="bg-white/90 backdrop-blur-sm border border-black/[0.08] rounded-2xl p-8 text-center">
                <p className="text-gray-500 text-sm">모든 항목에서 강점을 보였습니다.</p>
              </div>
            ) : (
              improvements.map((item, idx) => {
                const label = AXIS_LABELS[item.axis] ?? item.axisLabel;
                const priority = idx === 0 ? { tag: "우선 개선", cls: "bg-red-100 text-red-700" } : { tag: "개선 권고", cls: "bg-amber-100 text-amber-700" };
                return (
                  <div key={item.axis} className="bg-gray-50 rounded-xl p-4 border border-black/[0.06]">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="inline-flex items-center justify-center w-6 h-6 rounded-md text-white text-xs font-bold shrink-0"
                        style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
                      >
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-sm text-gray-900">{label}</span>
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-800">{item.score}점</span>
                      <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${priority.cls}`}>{priority.tag}</span>
                    </div>
                    <p className="text-sm text-gray-600 leading-[1.7]">{item.feedback}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
