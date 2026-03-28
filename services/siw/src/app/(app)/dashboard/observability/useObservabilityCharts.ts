"use client"
import { useMemo } from "react"
import type { ObservabilityResponse } from "@/lib/observability/schemas"
import { FEATURE_META, MODE_GROUPS, MODE_LABEL } from "@/lib/observability/constants"

const MODE_COLORS: Record<string, string> = {
  interview: "#6366F1",
  practice:  "#10B981",
  resume:    "#F59E0B",
}

export function featureName(key: string): string {
  return FEATURE_META[key]?.name ?? key.replace(/_/g, " ")
}
export function featureDesc(key: string): string {
  return FEATURE_META[key]?.desc ?? `"${key}" 기능의 AI 호출 현황입니다.`
}

export function useObservabilityCharts(data: ObservabilityResponse | null) {
  return useMemo(() => {
    if (!data) return null

    const { rows, summary } = data
    const dates = [...new Set(rows.map(r => r.date))].sort()

    const tokenAnomaly = summary.totalCalls > 0 && (summary.totalTokens ?? 0) === 0

    // 일별 비용 집계
    const costByDate = dates.map(d =>
      rows.filter(r => r.date === d).reduce((s, r) => s + (r.estimatedCostUsd ?? 0), 0),
    )

    const costLineData = {
      labels: dates,
      datasets: [
        { label: "일별 비용 (USD)", data: costByDate, borderColor: "#F59E0B", backgroundColor: "#F59E0B22", borderWidth: 2, pointRadius: 3, tension: 0.35, yAxisID: "yCost" },
      ],
    }

    // 에러율 — 전체 기간 집계, callCount < 10은 데이터 부족
    const errorRateByFeature = summary.featureTypes.map(ft => {
      const ftRows = rows.filter(r => r.featureType === ft)
      const totalCalls = ftRows.reduce((s, r) => s + r.callCount, 0)
      const totalErrors = ftRows.reduce((s, r) => s + r.errorCount, 0)
      return {
        featureType: ft,
        errorRate: totalCalls > 0 ? totalErrors / totalCalls : 0,
        callCount: totalCalls,
        insufficient: totalCalls < 10,
      }
    })

    // mode별 가중 평균 레이턴시 추이 (3개 선)
    const modeLatencyLineData = {
      labels: dates,
      datasets: [
        ...Object.entries(MODE_GROUPS).map(([mode, features]) => ({
          label: `${MODE_LABEL[mode]} 모드`,
          data: dates.map(d => {
            const modeRows = rows.filter(r => r.date === d && features.includes(r.featureType))
            const total = modeRows.reduce((s, r) => s + r.callCount, 0)
            return total > 0
              ? Math.round(modeRows.reduce((s, r) => s + r.avgLatencyMs * r.callCount, 0) / total)
              : null
          }),
          borderColor: MODE_COLORS[mode],
          backgroundColor: MODE_COLORS[mode] + "18",
          borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.35, spanGaps: true, order: 1,
        })),
        { label: "쾌적 (300ms)", data: dates.map(() => 300), borderColor: "#10B981", borderWidth: 1, borderDash: [5, 4], pointRadius: 0, tension: 0, spanGaps: true, order: 0 },
        { label: "개선 권고 (1500ms)", data: dates.map(() => 1500), borderColor: "#EF4444", borderWidth: 1, borderDash: [5, 4], pointRadius: 0, tension: 0, spanGaps: true, order: 0 },
      ],
    }

    // mode별 그룹 집계
    const modeGroupStats = Object.entries(MODE_GROUPS).map(([mode, features]) => {
      const modeRows = rows.filter(r => features.includes(r.featureType))
      const totalCalls = modeRows.reduce((s, r) => s + r.callCount, 0)
      const avgLatency = totalCalls > 0
        ? modeRows.reduce((s, r) => s + r.avgLatencyMs * r.callCount, 0) / totalCalls
        : 0
      const totalErrors = modeRows.reduce((s, r) => s + r.errorCount, 0)
      const errorRate = totalCalls > 0 ? totalErrors / totalCalls : 0
      const featureCounts = features.map(ft => ({
        ft,
        count: rows.filter(r => r.featureType === ft).reduce((s, r) => s + r.callCount, 0),
      }))
      return { mode, label: MODE_LABEL[mode], features, totalCalls, avgLatency, errorRate, featureCounts, insufficient: totalCalls < 10 }
    })

    return {
      tokenAnomaly,
      costLineData,
      errorRateByFeature,
      modeGroupStats,
      modeLatencyLineData,
    }
  }, [data])
}
