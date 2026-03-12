"use client";

import React, { useState, useCallback } from "react";

const AXES = [
  { name: "기술 정확도", weight: "20%", desc: "개념이 사실에 기반하는가",               current: 78, prev: 65 },
  { name: "설명 명확도", weight: "15%", desc: "이해하기 쉽게 설명했는가",               current: 82, prev: 70 },
  { name: "문제 해결",   weight: "15%", desc: "문제를 구조적으로 접근했는가",           current: 75, prev: 65 },
  { name: "의사소통",   weight: "15%", desc: "의도가 명확하게 전달됐는가",              current: 88, prev: 75 },
  { name: "논리 흐름",  weight: "10%", desc: "답변의 흐름이 일관적인가",                current: 76, prev: 68 },
  { name: "구체성",     weight: "10%", desc: "사례와 수치로 뒷받침했는가",              current: 72, prev: 62 },
  { name: "자신감",     weight: "10%", desc: "확신 있게 답변했는가",                    current: 85, prev: 72 },
  { name: "적응력",     weight:  "5%", desc: "예상치 못한 질문에 유연하게 대응했는가",  current: 80, prev: 70 },
] as const;

type AxisIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

function getScoreColor(score: number): string {
  if (score >= 85) return "#10B981";
  if (score >= 70) return "#7C3AED";
  return "#F59E0B";
}

function getBarStyle(score: number): React.CSSProperties {
  if (score >= 85) return { background: "linear-gradient(90deg, #10B981, #34D399)", width: `${score}%` };
  if (score >= 70) return { background: "linear-gradient(90deg, #7C3AED, #9B59E8)", width: `${score}%` };
  return { background: "linear-gradient(90deg, #F59E0B, #FCD34D)", width: `${score}%` };
}

interface AxisRowProps {
  axis: (typeof AXES)[number];
  isActive: boolean;
  isInactive: boolean;
  onEnter: () => void;
  onLeave: () => void;
}

function AxisRow({ axis, isActive, isInactive, onEnter, onLeave }: AxisRowProps) {
  const delta = axis.current - axis.prev;
  const scoreColor = getScoreColor(axis.current);

  return (
    <div
      className="axis-row"
      data-active={isActive}
      data-inactive={isInactive}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      tabIndex={0}
      role="button"
      aria-label={`${axis.name}: 현재 ${axis.current}점, 이전 ${axis.prev}점, ${delta > 0 ? `+${delta}` : delta}점 변화`}
    >
      <div className="axis-row__header">
        <div className="axis-row__meta">
          <span className="axis-row__name">{axis.name}</span>
          <span className="axis-row__weight">{axis.weight}</span>
        </div>
        <div className="axis-row__scores">
          <span className="axis-row__prev-score">{axis.prev}점</span>
          <span
            className="axis-row__delta"
            style={{
              color: delta > 0 ? "#10B981" : delta < 0 ? "#EF4444" : "#9CA3AF",
              background: delta > 0 ? "rgba(16,185,129,0.1)" : delta < 0 ? "rgba(239,68,68,0.1)" : "rgba(156,163,175,0.1)",
            }}
          >
            {delta > 0 ? `+${delta}` : delta}
          </span>
          <span className="axis-row__current-score" style={{ color: scoreColor }}>
            {axis.current}점
          </span>
        </div>
      </div>

      <div className="axis-row__track">
        <div className="axis-row__bar-prev" style={{ width: `${axis.prev}%`, background: "rgba(124,58,237,0.18)" }} aria-hidden="true" />
        <div className="axis-row__bar-current" style={getBarStyle(axis.current)} aria-hidden="true" />
      </div>

      <p className="axis-row__desc" aria-hidden={!isActive}>{axis.desc}</p>
    </div>
  );
}

export default function RadarChartInteractive() {
  const [activeAxis, setActiveAxis] = useState<AxisIndex | null>(null);

  const handleEnter = useCallback((i: AxisIndex) => setActiveAxis(i), []);
  const handleLeave = useCallback(() => setActiveAxis(null), []);

  const avgCurrent = Math.round(AXES.reduce((sum, a) => sum + a.current, 0) / AXES.length);
  const avgPrev = Math.round(AXES.reduce((sum, a) => sum + a.prev, 0) / AXES.length);
  const avgDelta = avgCurrent - avgPrev;
  const isHovered = activeAxis !== null;

  return (
    <div
      className={`score-grid-wrapper${isHovered ? " score-grid-hovered" : ""}`}
      role="region"
      aria-label="8개 역량 평가 점수 — 현재 및 이전 면접 결과 비교"
      onMouseLeave={handleLeave}
    >
      <div className="score-grid__summary">
        <span className="score-grid__summary-label">종합 점수</span>
        <div className="score-grid__summary-values">
          <span className="score-grid__summary-prev">{avgPrev}</span>
          <span className="score-grid__summary-arrow">→</span>
          <span className="score-grid__summary-current">{avgCurrent}</span>
          <span
            className="score-grid__summary-delta"
            style={{ color: avgDelta > 0 ? "#10B981" : avgDelta < 0 ? "#EF4444" : "#9CA3AF" }}
          >
            ({avgDelta > 0 ? `+${avgDelta}` : avgDelta})
          </span>
        </div>
      </div>

      <div className="score-grid__divider" aria-hidden="true" />

      <div className="score-grid__list">
        {AXES.map((axis, i) => (
          <AxisRow
            key={axis.name}
            axis={axis}
            isActive={activeAxis === i}
            isInactive={isHovered && activeAxis !== i}
            onEnter={() => handleEnter(i as AxisIndex)}
            onLeave={handleLeave}
          />
        ))}
      </div>

      <div className="score-grid__legend" aria-hidden="true">
        <div className="score-grid__legend-item score-grid__legend-item--current">현재</div>
        <div className="score-grid__legend-item score-grid__legend-item--prev">이전</div>
      </div>
    </div>
  );
}
