"use client"
import { type ReactNode, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Title,
  Tooltip,
  Legend,
} from "chart.js"
import { Line } from "react-chartjs-2"
import { ObservabilityResponseSchema } from "@/lib/observability/schemas"
import type { ObservabilityResponse } from "@/lib/observability/schemas"
import { useObservabilityCharts, featureName, featureDesc } from "./useObservabilityCharts"

const S3_LLM_EVENTS_URL = "https://s3.console.aws.amazon.com/s3/buckets/mirai-llm-logs-siw?prefix=llm-events/"

ChartJS.register(
  CategoryScale, LinearScale,
  PointElement, LineElement, LineController,
  Title, Tooltip, Legend
)

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

function SectionCard({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
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

function errorLevel(rate: number) {
  if (rate > 0.05) return { bg: "#FFF5F5", border: "#FED7D7", text: "#C53030", badge: "주의 필요", bar: "#C53030" }
  if (rate > 0)   return { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E", badge: "양호",     bar: "#F59E0B" }
  return             { bg: "#F0FDF4", border: "#BBF7D0", text: "#166534", badge: "정상",     bar: "#10B981" }
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

  const charts = useObservabilityCharts(data)

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-4">
        <div className="h-8 w-52 rounded-lg bg-slate-100 animate-pulse" />
        <div className="h-4 w-80 rounded bg-slate-100 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

  if (!charts) return null

  const { summary } = data
  const {
    tokenAnomaly,
    costLineData,
    errorRateByFeature,
    modeGroupStats, modeLatencyLineData,
  } = charts

  // ── Chart options ────────────────────────────────────────────
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

      {/* ── 3초 영역: Critical KPI ── */}
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">전체 요약</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
          <StatCard
            label="평균 에러율"
            value={`${(summary.avgErrorRate * 100).toFixed(2)}%`}
            unit=""
            tooltip="전체 AI 호출 중 에러가 발생한 비율. 5% 초과 시 즉시 확인이 필요합니다."
            accent={summary.avgErrorRate > 0.05 ? "#EF4444" : summary.avgErrorRate > 0 ? "#F59E0B" : "#10B981"}
            warning={summary.avgErrorRate > 0.05 ? "에러율 5% 초과 — 즉시 확인 필요" : undefined}
          />
        </div>
      </div>

      {/* ── 30초 영역: 기능 그룹별 현황 ── */}

      {(() => {
        const MODE_STYLES: Record<string, { border: string; badge: string; badgeText: string; iconBg: string; barColor: string; label: string }> = {
          interview: { border: "#6366F1", badge: "#EEF2FF", badgeText: "#4338CA", iconBg: "#EEF2FF", barColor: "#6366F1", label: "실전 면접" },
          practice:  { border: "#10B981", badge: "#ECFDF5", badgeText: "#065F46", iconBg: "#ECFDF5", barColor: "#10B981", label: "연습 면접" },
          resume:    { border: "#F59E0B", badge: "#FFFBEB", badgeText: "#92400E", iconBg: "#FFFBEB", barColor: "#F59E0B", label: "이력서 분석" },
        }
        const totalCallsAll = modeGroupStats.reduce((s, m) => s + m.totalCalls, 0)
        return (
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">기능 그룹별 현황</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {modeGroupStats.map(({ mode, totalCalls, avgLatency, errorRate, featureCounts, insufficient }) => {
                const s = MODE_STYLES[mode]
                const groupPct = totalCallsAll > 0 ? (totalCalls / totalCallsAll) * 100 : 0
                const maxCount = Math.max(...featureCounts.map(f => f.count), 1)
                return (
                  <div key={mode} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100"
                    style={{ borderTop: `3px solid ${s.border}` }}>
                    <div className="p-5">
                      {/* 모드 헤더 */}
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-sm font-black text-slate-800">{s.label}</span>
                        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: s.badge, color: s.badgeText }}>
                          {groupPct.toFixed(0)}%
                        </span>
                      </div>

                      {/* 핵심 지표 3개 */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="text-center">
                          <p className="text-xl font-black text-slate-800">{totalCalls.toLocaleString()}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">총 호출</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-black text-slate-800">{Math.round(avgLatency).toLocaleString()}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">평균 ms</p>
                        </div>
                        <div className="text-center">
                          {insufficient ? (
                            <>
                              <p className="text-xl font-black text-slate-300">—</p>
                              <p className="text-[10px] text-slate-300 mt-0.5">에러율</p>
                            </>
                          ) : (
                            <>
                              <p className="text-xl font-black" style={{ color: (errorRate * 100) > 5 ? "#EF4444" : "#10B981" }}>
                                {(errorRate * 100).toFixed(1)}%
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5">에러율</p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 전체 대비 비중 바 */}
                      <div className="h-1 rounded-full bg-slate-100 mb-4 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${groupPct}%`, background: s.border }} />
                      </div>

                      {/* feature별 사용량 바 */}
                      <div className="space-y-2.5">
                        {featureCounts.map(({ ft, count }) => (
                          <div key={ft}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[11px] font-medium text-slate-600">{featureName(ft)}</span>
                              <span className="text-[10px] text-slate-400">{count.toLocaleString()}건</span>
                            </div>
                            <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${(count / maxCount) * 100}%`, background: s.barColor + "99" }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── 응답 속도 추이 (모드 통합, 기준선 없음) ── */}
      <SectionCard title="응답 속도 추이" desc="면접·연습·이력서 모드별 가중 평균 레이턴시 추이">
        <div style={{ height: "220px" }}>
          <Line
            data={{ labels: modeLatencyLineData.labels, datasets: modeLatencyLineData.datasets.filter(d => !("borderDash" in d)) }}
            options={lineOptions}
          />
        </div>
      </SectionCard>

      {/* ── 일별 비용 추이 ── */}
      <SectionCard title="일별 비용 추이" desc="하루 동안 소비된 AI 호출 비용(USD) 변화입니다.">
        <div style={{ height: "200px" }}>
          <Line
            data={{ labels: costLineData.labels, datasets: [{ ...costLineData.datasets[0], yAxisID: undefined }] }}
            options={{
              responsive: true, maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                tooltip: { callbacks: { label: (ctx: any) => ` $${(ctx.parsed.y ?? 0).toFixed(5)}` } },
              },
              scales: {
                x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#94A3B8" } },
                y: { grid: { color: "rgba(0,0,0,0.04)" }, ticks: { font: { size: 10 }, color: "#F59E0B", callback: (v: number | string) => `$${Number(v).toFixed(4)}` } },
              },
            }}
          />
        </div>
      </SectionCard>

      {/* ── 기능별 오류율 (드릴다운) ── */}
      <SectionCard title="기능별 오류율" desc="조회 기간 전체 집계 기준. 5% 이상이면 즉시 확인이 필요합니다. 10건 미만은 통계 신뢰도가 낮습니다.">
        <div className="space-y-2.5">
          {errorRateByFeature.map(({ featureType, errorRate, callCount, insufficient }) => {
            if (insufficient) {
              return (
                <div key={featureType} className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-500">{featureName(featureType)}</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-500">
                      데이터 부족 ({callCount}건)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{featureDesc(featureType)}</p>
                </div>
              )
            }
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
                      href={S3_LLM_EVENTS_URL}
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
