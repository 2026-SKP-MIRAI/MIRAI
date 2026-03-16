"use client"
import React, { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, RadialLinearScale, Filler, Tooltip, Legend,
} from "chart.js"
import { Line, Bar } from "react-chartjs-2"
import type { GrowthSession, AxisScores } from "@/lib/types"

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, RadialLinearScale, Filler, Tooltip, Legend
)

const AXIS_LABELS: Record<keyof AxisScores, string> = {
  communication: "의사소통",
  problemSolving: "문제해결",
  logicalThinking: "논리적 사고",
  jobExpertise: "직무 전문성",
  cultureFit: "조직 적합성",
  leadership: "리더십",
  creativity: "창의성",
  sincerity: "성실성",
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.065 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const } },
}

function ScoreBar({ score, animated }: { score: number; animated: boolean }) {
  const color = score >= 80 ? "linear-gradient(90deg,#10B981,#34D399)"
    : score >= 65 ? "linear-gradient(90deg,#7C3AED,#9B59E8)"
    : "linear-gradient(90deg,#F59E0B,#D97706)"
  return (
    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
      <div
        className="h-full rounded-full transition-[width] duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ width: animated ? `${score}%` : "0%", background: color }}
      />
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
}

export default function GrowthPage() {
  const [sessions, setSessions] = useState<GrowthSession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    fetch("/api/growth/sessions")
      .then(r => r.json())
      .then((data: GrowthSession[]) => {
        setSessions(Array.isArray(data) ? data : [])
        if (data.length > 0) setSelectedId(data[0].id)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setAnimated(true), 80)
      return () => clearTimeout(t)
    }
  }, [loading])

  const selectedSession = sessions.find(s => s.id === selectedId) ?? sessions[0]
  const latest = sessions[0]
  const prev = sessions[1]

  const growthDiff = latest && prev ? latest.reportTotalScore - prev.reportTotalScore : null

  // 차트 데이터 (시간 오름차순)
  const chronological = [...sessions].reverse()
  const labels = chronological.map((s, i) => `${i + 1}회차`)
  const scoreData = chronological.map(s => s.reportTotalScore)

  const axisKeys = Object.keys(AXIS_LABELS) as (keyof AxisScores)[]

  const lineData = {
    labels,
    datasets: [
      {
        label: "종합 점수",
        data: scoreData,
        backgroundColor: "rgba(124,58,237,0.15)",
        borderColor: "#7C3AED",
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#7C3AED",
        pointBorderColor: "white",
        pointBorderWidth: 2,
        pointRadius: 5,
      },
      {
        label: "목표 (70점)",
        data: labels.map(() => 70),
        borderColor: "#10B981",
        borderWidth: 1.5,
        borderDash: [6, 4],
        fill: false,
        pointRadius: 0,
        tension: 0,
      },
    ],
  }

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true, position: "top" as const, labels: { font: { size: 11 }, boxWidth: 12, padding: 10 } } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 }, color: "#9CA3AF" } },
      y: { min: 40, max: 100, grid: { color: "rgba(0,0,0,0.05)" }, ticks: { stepSize: 20, font: { size: 11 }, color: "#9CA3AF", callback: (v: number | string) => `${v}점` } },
    },
  }

  const barData = {
    labels: axisKeys.map(k => AXIS_LABELS[k]),
    datasets: [
      {
        label: "현재",
        data: axisKeys.map(k => latest?.scores[k] ?? 0),
        backgroundColor: "#4F46E5",
        borderRadius: 4,
        barPercentage: 0.6,
      },
      ...(prev ? [{
        label: "이전",
        data: axisKeys.map(k => prev.scores[k] ?? 0),
        backgroundColor: "#C4B5FD",
        borderRadius: 4,
        barPercentage: 0.6,
      }] : []),
    ],
  }

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#9CA3AF" } },
      y: { min: 40, max: 100, grid: { color: "rgba(0,0,0,0.05)" }, ticks: { stepSize: 20, font: { size: 11 }, color: "#9CA3AF" } },
    },
  }

  // 강점 & 약점 패턴
  const axisAverages = axisKeys.map(k => ({
    key: k,
    label: AXIS_LABELS[k],
    avg: sessions.length > 0 ? Math.round(sessions.reduce((s, x) => s + x.scores[k], 0) / sessions.length) : 0,
  })).sort((a, b) => b.avg - a.avg)
  const strengths = axisAverages.slice(0, 3)
  const weaknesses = axisAverages.slice(-2)

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-40 rounded-2xl bg-gray-100 animate-pulse" />)}
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">성장 추이</h1>
        <p className="text-gray-500 mb-8">면접 실력이 얼마나 성장했는지 확인하세요</p>
        <div className="bg-white/90 border border-black/[0.08] rounded-2xl p-12 text-center">
          <p className="text-gray-400 mb-4">면접을 완료하면 성장 추이가 여기에 표시됩니다</p>
          <Link
            href="/interview/new"
            className="inline-block text-white rounded-full px-6 py-3 font-semibold shadow-[0_4px_14px_rgba(124,58,237,0.35)] active:scale-95 transition-all"
            style={{ background: "linear-gradient(135deg,#7C3AED,#4F46E5)" }}
          >
            면접 시작하기
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-5">
        {/* 헤더 */}
        <motion.div variants={itemVariants}>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">성장 추이</h1>
          <p className="text-gray-500 mt-1 text-sm">면접 실력이 얼마나 성장했는지 확인하세요</p>
        </motion.div>

        {/* 통계 2카드 */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div variants={itemVariants} className="bg-white/90 border border-black/[0.08] rounded-2xl p-6 text-center hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] transition-all">
            <p className="text-sm text-gray-400 mb-2">총 면접 횟수</p>
            <p className="text-4xl font-extrabold" style={{ background: "linear-gradient(135deg,#7C3AED,#4F46E5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {sessions.length}회
            </p>
            <p className="text-xs text-gray-400 mt-1">전체</p>
          </motion.div>
          <motion.div variants={itemVariants} className="bg-white/90 border border-black/[0.08] rounded-2xl p-6 text-center hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] transition-all">
            <p className="text-sm text-gray-400 mb-2">최신 점수</p>
            <p className="text-4xl font-extrabold text-emerald-600">{latest.reportTotalScore}점</p>
            {growthDiff !== null && (
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold mt-2 ${growthDiff >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                {growthDiff >= 0 ? "+" : ""}{growthDiff}점
              </span>
            )}
          </motion.div>
        </div>

        {/* 종합 점수 추이 */}
        <motion.div variants={itemVariants} className="bg-white/90 border border-black/[0.08] rounded-2xl p-6 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] transition-all">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-bold text-gray-900">종합 점수 추이</h3>
            {growthDiff !== null && (
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800">
                {growthDiff >= 0 ? "+" : ""}{growthDiff}점 향상
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-4">목표선: 70점 (점선)</p>
          <div style={{ height: "200px" }}>
            <Line data={lineData} options={lineOptions} />
          </div>
        </motion.div>

        {/* 8축 역량 비교 */}
        <motion.div variants={itemVariants} className="bg-white/90 border border-black/[0.08] rounded-2xl p-6 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] transition-all">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">8축 역량 비교</h3>
            <div className="flex gap-3 text-xs items-center">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block bg-indigo-600" /> 현재</span>
              {prev && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block bg-violet-200" /> 이전</span>}
            </div>
          </div>
          <div style={{ height: "240px" }}>
            <Bar data={barData} options={barOptions} />
          </div>
        </motion.div>

        {/* 축별 성장량 */}
        <motion.div variants={itemVariants} className="bg-white/90 border border-black/[0.08] rounded-2xl p-6 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] transition-all">
          <h3 className="text-lg font-bold text-gray-900 mb-4">축별 성장량</h3>
          {axisKeys.map(k => {
            const curr = latest?.scores[k] ?? 0
            const prevScore = prev?.scores[k]
            const diff = prevScore !== undefined ? curr - prevScore : null
            return (
              <div key={k} className="flex items-center justify-between py-2.5 border-b border-black/[0.05] last:border-0">
                <span className="text-sm font-semibold text-gray-900">{AXIS_LABELS[k]}</span>
                <div className="flex items-center gap-2">
                  {prevScore !== undefined && (
                    <span className="text-xs text-gray-400">{prevScore} → {curr}</span>
                  )}
                  {diff !== null ? (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${diff > 0 ? "bg-emerald-100 text-emerald-800" : diff < 0 ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-600"}`}>
                      {diff > 0 ? "+" : ""}{diff}
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-gray-700">{curr}점</span>
                  )}
                </div>
              </div>
            )
          })}
        </motion.div>

        {/* 하단 2열 */}
        <div className="grid grid-cols-2 gap-5">
          {/* 세션 목록 */}
          <motion.div variants={itemVariants} className="bg-white/90 border border-black/[0.08] rounded-2xl p-5 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] transition-all">
            <h3 className="text-sm font-bold text-gray-900 mb-3">면접 기록</h3>
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`w-full text-left flex items-center justify-between py-2.5 px-3 rounded-xl mb-1 transition-all ${
                  selectedId === s.id
                    ? "bg-violet-50 border-l-2 border-violet-600"
                    : "hover:bg-gray-50"
                }`}
              >
                <div>
                  <p className="text-xs font-semibold text-gray-900">{formatDate(s.createdAt)}</p>
                  <p className="text-[11px] text-gray-400 truncate max-w-[120px]">{s.resumeLabel}</p>
                </div>
                <span className="text-sm font-bold text-gray-700">{s.reportTotalScore}점</span>
              </button>
            ))}
          </motion.div>

          {/* 선택된 세션 8축 */}
          <motion.div variants={itemVariants} className="bg-white/90 border border-black/[0.08] rounded-2xl p-5 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] transition-all">
            <h3 className="text-sm font-bold text-gray-900 mb-3">
              {selectedSession ? formatDate(selectedSession.createdAt) : ""}  8축 점수
            </h3>
            {selectedSession ? (
              <>
                {axisKeys.map(k => (
                  <div key={k} className="flex items-center gap-2 mb-2.5">
                    <span className="w-[80px] text-xs text-gray-700 shrink-0">{AXIS_LABELS[k]}</span>
                    <ScoreBar score={selectedSession.scores[k]} animated={animated} />
                    <span className="w-7 text-right text-xs font-bold text-gray-900 shrink-0">{selectedSession.scores[k]}</span>
                  </div>
                ))}
                <Link
                  href={`/interview/${selectedSession.id}/report`}
                  className="mt-3 text-xs text-violet-600 font-semibold hover:underline block"
                >
                  리포트 전체 보기 →
                </Link>
              </>
            ) : (
              <p className="text-xs text-gray-400">세션을 선택하세요</p>
            )}
          </motion.div>

          {/* 강점 & 약점 패턴 */}
          {sessions.length >= 2 && (
            <motion.div variants={itemVariants} className="col-span-2 bg-white/90 border border-black/[0.08] rounded-2xl p-5 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] transition-all">
              <h3 className="text-sm font-bold text-gray-900 mb-3">강점 & 약점 패턴</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">꾸준한 강점</p>
                  {strengths.map(s => (
                    <div key={s.key} className="flex items-center gap-2 mb-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-xs text-gray-700">{s.label} — 평균 {s.avg}점</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">반복 약점</p>
                  {weaknesses.map(w => (
                    <div key={w.key} className="flex items-center gap-2 mb-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                      <span className="text-xs text-gray-700">{w.label} — 평균 {w.avg}점</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
