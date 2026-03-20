"use client"
import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  PointElement,
  LineElement,
  LineController,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js"
import { Bar, Line, Doughnut } from "react-chartjs-2"
import { ObservabilityResponseSchema } from "@/lib/observability/schemas"
import type { ObservabilityResponse } from "@/lib/observability/schemas"

ChartJS.register(
  CategoryScale, LinearScale, BarElement, BarController,
  PointElement, LineElement, LineController, ArcElement,
  Title, Tooltip, Legend
)

// ─── 기능명 매핑 ────────────────────────────────────────────────
const FEATURE_META: Record<string, { name: string; desc: string }> = {
  interview_start:    { name: "면접 시작",   desc: "면접 세션을 시작할 때 AI가 첫 질문을 생성하는 단계입니다." },
  interview_answer:   { name: "답변 분석",   desc: "사용자의 면접 답변을 AI가 읽고 내용을 분석하는 단계입니다." },
  interview_feedback: { name: "면접 피드백", desc: "분석된 답변을 바탕으로 AI가 개선 피드백을 작성하는 단계입니다." },
  question_generate:  { name: "질문 생성",   desc: "직무·이력서 맞춤형 면접 질문을 AI가 생성하는 단계입니다." },
  resume_parse:       { name: "이력서 분석", desc: "업로드된 이력서를 AI가 읽고 주요 정보를 추출하는 단계입니다." },
  answer_evaluate:    { name: "답변 평가",   desc: "면접 답변의 완성도·논리성을 AI가 점수화하는 단계입니다." },
  feedback_generate:  { name: "피드백 생성", desc: "면접 전 과정을 종합해 최종 피드백 리포트를 생성하는 단계입니다." },
}

function featureName(key: string) {
  return FEATURE_META[key]?.name ?? key.replace(/_/g, " ")
}
function featureDesc(key: string) {
  return FEATURE_META[key]?.desc ?? `"${key}" 기능의 AI 호출 현황입니다.`
}

const PALETTE = ["#0EA5E9","#6366F1","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#14B8A6"]
const DAY_OPTIONS = [7, 14, 30] as const

// ─── 공통 컴포넌트 ───────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-1.5 align-middle">
      <span className="cursor-help text-[10px] font-bold text-slate-300 border border-slate-200 rounded-full w-[16px] h-[16px] inline-flex items-center justify-center hover:text-slate-500 hover:border-slate-400 transition-colors select-none">
        i
      </span>
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-slate-900 text-white text-[11px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 leading-relaxed shadow-2xl">
        {text}
      </span>
    </span>
  )
}

function StatCard({ label, value, unit, tooltip, accent, warning }: {
  label: string; value: string; unit: string; tooltip: string; accent: string; warning?: string
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        <InfoTooltip text={tooltip} />
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-3xl font-black leading-none" style={{ color: accent }}>{value}</span>
        <span className="text-xs text-slate-400 mb-0.5">{unit}</span>
      </div>
      {warning && (
        <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
          <span>⚠</span> {warning}
        </div>
      )}
    </div>
  )
}

function SectionCard({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {desc && <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

// ─── 메인 대시보드 ───────────────────────────────────────────────

export default function ObservabilityDashboard() {
  const router = useRouter()
  const [days, setDays] = useState<number>(30)
  const [data, setData] = useState<ObservabilityResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/dashboard/observability?days=${days}`)
      .then((r) => {
        if (r.status === 401) { router.replace("/"); return null }
        if (r.status === 403) { router.replace("/dashboard"); return null }
        return r.json()
      })
      .then((json) => {
        if (json) setData(ObservabilityResponseSchema.parse(json))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [days, router])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-4">
        <div className="h-8 w-52 rounded-lg bg-slate-100 animate-pulse" />
        <div className="h-4 w-80 rounded bg-slate-100 animate-pulse" />
        <div className="grid grid-cols-4 gap-4 pt-2">
          {[1,2,3,4].map(i => <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" />
          <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" />
        </div>
        <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    )
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-black text-slate-900 mb-1">AI 기능 운영 현황</h1>
        <p className="text-sm text-slate-400 mb-8">AI 기능 사용량·응답 속도·오류율·비용을 한눈에 모니터링합니다</p>
        <div className="bg-white border border-slate-100 rounded-2xl p-16 text-center shadow-sm">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-slate-700 font-semibold mb-1">아직 데이터가 없습니다</p>
          <p className="text-sm text-slate-400">AI 기능이 사용되면 이 화면에 통계가 나타납니다</p>
        </div>
      </div>
    )
  }

  const { rows, summary } = data
  const dates = [...new Set(rows.map(r => r.date))].sort()
  const colorMap: Record<string, string> = {}
  summary.featureTypes.forEach((ft, i) => { colorMap[ft] = PALETTE[i % PALETTE.length] })

  const tokenAnomaly = summary.totalCalls > 0 && (summary.totalTokens ?? 0) === 0

  // 일별 집계
  const costByDate = dates.map(d => rows.filter(r => r.date === d).reduce((s, r) => s + (r.estimatedCostUsd ?? 0), 0))
  const tokenByDate = dates.map(d => rows.filter(r => r.date === d).reduce((s, r) => s + (r.totalTokens ?? 0), 0))

  // 토큰 비율 (전체 합산)
  const totalPrompt = rows.reduce((s, r) => s + (r.promptTokens ?? 0), 0)
  const totalCompletion = rows.reduce((s, r) => s + (r.completionTokens ?? 0), 0)
  const hasTokenSplit = totalPrompt + totalCompletion > 0

  // ── Grouped Bar ────────────────────────────────────────────────
  const barData = {
    labels: dates,
    datasets: summary.featureTypes.map(ft => ({
      label: featureName(ft),
      data: dates.map(d => rows.find(r => r.date === d && r.featureType === ft)?.callCount ?? 0),
      backgroundColor: colorMap[ft],
      borderRadius: 3,
      barPercentage: 0.8,
      categoryPercentage: 0.85,
    })),
  }
  const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: "top" as const, labels: { font: { size: 11 }, boxWidth: 10, padding: 10, color: "#64748B" } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toLocaleString()}건` } },
    },
    scales: {
      x: { stacked: false, grid: { display: false }, ticks: { font: { size: 10 }, color: "#94A3B8" } },
      y: { stacked: false, grid: { color: "rgba(0,0,0,0.04)" }, ticks: { font: { size: 11 }, color: "#94A3B8", callback: (v: number | string) => `${v}건` } },
    },
  }

  // ── Latency + 기준선 ────────────────────────────────────────────
  const lineData = {
    labels: dates,
    datasets: [
      ...summary.featureTypes.map(ft => ({
        label: featureName(ft),
        data: dates.map(d => { const r = rows.find(row => row.date === d && row.featureType === ft); return r ? Math.round(r.avgLatencyMs) : null }),
        borderColor: colorMap[ft], backgroundColor: colorMap[ft] + "18",
        borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.35, spanGaps: true, order: 1,
      })),
      { label: "빠름 (300ms)", data: dates.map(() => 300), borderColor: "#10B981", borderWidth: 1, borderDash: [5, 4], pointRadius: 0, tension: 0, spanGaps: true, order: 0 },
      { label: "느림 (1500ms)", data: dates.map(() => 1500), borderColor: "#EF4444", borderWidth: 1, borderDash: [5, 4], pointRadius: 0, tension: 0, spanGaps: true, order: 0 },
    ],
  }
  const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: "top" as const, labels: { font: { size: 11 }, boxWidth: 10, padding: 10, color: "#64748B" } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toLocaleString()}ms` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#94A3B8" } },
      y: { grid: { color: "rgba(0,0,0,0.04)" }, ticks: { font: { size: 11 }, color: "#94A3B8", callback: (v: number | string) => `${v}ms` } },
    },
  }

  // ── 비용·토큰 추이 ────────────────────────────────────────────
  const costLineData = {
    labels: dates,
    datasets: [
      { label: "일별 비용 (USD)", data: costByDate, borderColor: "#F59E0B", backgroundColor: "#F59E0B22", borderWidth: 2, pointRadius: 3, tension: 0.35, yAxisID: "yCost" },
      { label: "일별 토큰", data: tokenByDate, borderColor: "#8B5CF6", backgroundColor: "#8B5CF622", borderWidth: 2, pointRadius: 3, tension: 0.35, yAxisID: "yToken" },
    ],
  }
  const costLineOptions = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: "index" as const },
    plugins: {
      legend: { display: true, position: "top" as const, labels: { font: { size: 11 }, boxWidth: 10, padding: 10, color: "#64748B" } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tooltip: { callbacks: { label: (ctx: any) => ctx.datasetIndex === 0 ? ` $${(ctx.parsed.y ?? 0).toFixed(5)}` : ` ${(ctx.parsed.y ?? 0).toLocaleString()} 토큰` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#94A3B8" } },
      yCost: { position: "left" as const, grid: { color: "rgba(0,0,0,0.04)" }, ticks: { font: { size: 10 }, color: "#F59E0B", callback: (v: number | string) => `$${Number(v).toFixed(4)}` } },
      yToken: { position: "right" as const, grid: { display: false }, ticks: { font: { size: 10 }, color: "#8B5CF6", callback: (v: number | string) => `${Number(v).toLocaleString()}` } },
    },
  }

  // ── 토큰 비율 도넛 ────────────────────────────────────────────
  const donutData = {
    labels: ["입력 토큰 (프롬프트)", "출력 토큰 (생성)"],
    datasets: [{ data: [totalPrompt, totalCompletion], backgroundColor: ["#6366F1", "#10B981"], borderWidth: 0 }],
  }
  const donutOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: "bottom" as const, labels: { font: { size: 11 }, boxWidth: 10, padding: 12, color: "#64748B" } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.label}: ${(ctx.parsed ?? 0).toLocaleString()} (${totalPrompt + totalCompletion > 0 ? ((ctx.parsed / (totalPrompt + totalCompletion)) * 100).toFixed(1) : 0}%)` } },
    },
  }

  // ── 에러율 ────────────────────────────────────────────────────
  const latestDate = dates[dates.length - 1]
  const errorRateByFeature = summary.featureTypes.map(ft => {
    const row = rows.find(r => r.date === latestDate && r.featureType === ft)
    return { featureType: ft, errorRate: row?.errorRate ?? 0 }
  })
  function errorLevel(rate: number) {
    if (rate > 0.05) return { bg: "#FFF5F5", border: "#FED7D7", text: "#C53030", badge: "주의 필요", bar: "#C53030" }
    if (rate > 0)   return { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E", badge: "양호",     bar: "#F59E0B" }
    return             { bg: "#F0FDF4", border: "#BBF7D0", text: "#166534", badge: "정상",     bar: "#10B981" }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">

      {/* 헤더 */}
      <div className="border-b border-slate-100 pb-5">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">AI 기능 운영 현황</h1>
        <p className="text-sm text-slate-500 mt-1.5">
          AI 기능 사용량 · 응답 속도 · 오류율 · 비용을 한눈에 모니터링합니다. 데이터는 매일 새벽 자동 집계됩니다.
        </p>
      </div>

      {/* 기간 필터 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 font-medium mr-1">조회 기간</span>
        {DAY_OPTIONS.map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${
              days === d
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "bg-white border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700"
            }`}
          >
            최근 {d}일
          </button>
        ))}
      </div>

      {/* KPI 카드 4개 */}
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">전체 요약</p>
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="총 AI 호출 횟수" value={summary.totalCalls.toLocaleString()} unit="건"
            tooltip={`최근 ${days}일간 AI 기능이 사용된 총 횟수입니다.`} accent="#0EA5E9" />
          <StatCard label="총 사용 토큰" value={(summary.totalTokens ?? 0).toLocaleString()} unit="토큰"
            tooltip="AI 입력(프롬프트)과 출력(생성) 토큰의 합산입니다. 750 토큰 ≒ 영문 500단어."
            accent="#8B5CF6"
            warning={tokenAnomaly ? "호출은 발생했으나 토큰이 0입니다 — 집계 누락 가능성" : undefined} />
          <StatCard label="평균 응답 시간" value={Math.round(summary.avgLatency).toLocaleString()} unit="ms"
            tooltip="AI가 결과를 반환하기까지 걸린 평균 시간. 300ms 이하 쾌적 / 1500ms 이상 개선 권고."
            accent={summary.avgLatency > 1500 ? "#EF4444" : summary.avgLatency > 300 ? "#F59E0B" : "#10B981"} />
          <StatCard label="예상 AI 비용" value={`$${(summary.totalCostUsd ?? 0).toFixed(4)}`} unit="USD"
            tooltip={`최근 ${days}일간 AI API 호출 예상 비용입니다. 토큰 사용량 기반 추정치입니다.`}
            accent="#F59E0B" />
        </div>
      </div>

      {/* 차트 2열: 호출 건수 + 비용·토큰 */}
      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="기능별 일별 사용 횟수" desc="날짜별 각 AI 기능의 호출 건수 (그룹 막대)">
          <div style={{ height: "200px" }}><Bar data={barData} options={barOptions} /></div>
        </SectionCard>
        <SectionCard title="일별 비용 · 토큰 추이" desc="하루 동안 소비된 비용(USD)과 토큰 수의 변화입니다.">
          <div style={{ height: "200px" }}><Line data={costLineData} options={costLineOptions} /></div>
        </SectionCard>
      </div>

      {/* 응답속도 + 토큰 비율 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <SectionCard title="응답 속도 추이" desc="초록 점선(300ms) = 쾌적 기준 / 빨간 점선(1500ms) = 개선 권고 기준">
            <div style={{ height: "200px" }}><Line data={lineData} options={lineOptions} /></div>
          </SectionCard>
        </div>
        <SectionCard
          title="입력 / 출력 토큰 비율"
          desc="입력(프롬프트) vs 출력(생성) 토큰 비율입니다. 입력이 지나치게 크면 프롬프트 최적화를 검토하세요."
        >
          {hasTokenSplit ? (
            <>
              <div style={{ height: "160px" }}><Doughnut data={donutData} options={donutOptions} /></div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="bg-indigo-50 rounded-xl p-2">
                  <p className="text-[11px] text-indigo-500 font-semibold">입력</p>
                  <p className="text-sm font-black text-indigo-700">{totalPrompt.toLocaleString()}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-2">
                  <p className="text-[11px] text-emerald-600 font-semibold">출력</p>
                  <p className="text-sm font-black text-emerald-700">{totalCompletion.toLocaleString()}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <p className="text-2xl mb-2">🔀</p>
              <p className="text-xs font-semibold text-slate-500">데이터 집계 중</p>
              <p className="text-[11px] text-slate-400 mt-1">스키마 마이그레이션 후 표시됩니다</p>
            </div>
          )}
        </SectionCard>
      </div>

      {/* 에러율 */}
      <SectionCard title="기능별 오류율" desc={`최근 날짜(${latestDate}) 기준. 5% 이상이면 즉시 확인이 필요합니다.`}>
        <div className="space-y-2.5">
          {errorRateByFeature.map(({ featureType, errorRate }) => {
            const c = errorLevel(errorRate)
            const pct = errorRate * 100
            return (
              <div key={featureType} className="rounded-xl border p-4" style={{ background: c.bg, borderColor: c.border }}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold" style={{ color: c.text }}>{featureName(featureType)}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: c.bar + "25", color: c.text }}>{c.badge}</span>
                    </div>
                    <p className="text-[11px] truncate" style={{ color: c.text + "99" }}>{featureDesc(featureType)}</p>
                    <div className="mt-2 h-1 rounded-full bg-black/[0.06] overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct * 4, 100)}%`, background: c.bar }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xl font-black leading-none" style={{ color: c.text }}>{pct.toFixed(1)}%</p>
                      <p className="text-[10px] mt-0.5" style={{ color: c.text + "88" }}>오류 비율</p>
                    </div>
                    <a
                      href={`https://s3.console.aws.amazon.com/s3/buckets/mirai-llm-logs-siw?prefix=logs/${featureType}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap"
                      style={{ borderColor: c.bar + "55", color: c.text, background: "white" }}
                    >
                      로그 확인 →
                    </a>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </SectionCard>

      {summary.lastUpdated && (
        <p className="text-xs text-slate-400 text-right pb-4">마지막 데이터 업데이트: {summary.lastUpdated}</p>
      )}
    </div>
  )
}
