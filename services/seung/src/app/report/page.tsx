'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ReportResponse } from '@/lib/types'

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">리포트를 불러오는 중...</p>
    </div>
  )
}

const AXIS_LABEL_MAP: Record<string, string> = {
  communication: '의사소통',
  problemSolving: '문제해결',
  logicalThinking: '논리적 사고',
  jobExpertise: '직무 전문성',
  cultureFit: '조직 적합성',
  leadership: '리더십',
  creativity: '창의성',
  sincerity: '성실성',
}

function ReportContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reportId = searchParams.get('reportId')

  const [report, setReport] = useState<ReportResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!reportId) {
      router.replace('/resume')
      return
    }

    fetch(`/api/report?reportId=${reportId}`)
      .then((r) => {
        if (!r.ok) {
          router.replace('/resume')
          return null
        }
        return r.json()
      })
      .then((data) => {
        if (!data) return
        setReport(data)
      })
      .catch(() => {
        router.replace('/resume')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [reportId, router])

  if (loading) {
    return <LoadingScreen />
  }

  if (!report) return null

  const scoreEntries = Object.entries(report.scores ?? {}) as [string, number][]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-lg font-bold text-gray-900">MirAI — 역량 평가 리포트</h1>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8 space-y-8">
        {/* 총점 */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-gray-500 mb-1">종합 점수</p>
          <p className="text-6xl font-bold text-gray-900">{report.totalScore}</p>
          <p className="text-sm text-gray-400 mt-1">/ 100</p>
        </section>

        {/* 8축 점수 */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">역량 축별 점수</h2>
          <div className="space-y-3">
            {scoreEntries.map(([axis, score]) => {
              const feedback = (report.axisFeedbacks ?? []).find((f) => f.axis === axis)
              const colorClass =
                feedback?.type === 'strength'
                  ? { text: 'text-blue-600', bar: 'bg-blue-500' }
                  : feedback?.type === 'improvement'
                    ? { text: 'text-orange-500', bar: 'bg-orange-400' }
                    : { text: 'text-gray-600', bar: 'bg-gray-400' }
              return (
                <div key={axis}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">
                      {AXIS_LABEL_MAP[axis] ?? axis}
                    </span>
                    <span className={`font-semibold ${colorClass.text}`}>
                      {score}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${colorClass.bar}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* 종합 요약 */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-2">종합 요약</h2>
          <p className="text-gray-700 leading-relaxed">{report.summary}</p>
        </section>

        {/* 축별 피드백 카드 */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">축별 피드백</h2>
          {(report.axisFeedbacks ?? []).map((fb) => (
            <div
              key={fb.axis}
              className={`rounded-xl border p-4 ${
                fb.type === 'strength'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-orange-50 border-orange-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-gray-900 text-sm">{fb.axisLabel}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    fb.type === 'strength'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}
                >
                  {fb.type === 'strength' ? '강점' : '개선'}
                </span>
                <span className="ml-auto text-sm font-semibold text-gray-600">{fb.score}점</span>
              </div>
              <p className="text-sm text-gray-700">{fb.feedback}</p>
            </div>
          ))}
        </section>

        {/* growthCurve 플레이스홀더 */}
        <section className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-gray-400">성장 곡선은 추후 업데이트 예정입니다.</p>
        </section>

        {/* 홈으로 */}
        <div className="flex justify-center pb-8">
          <button
            onClick={() => router.push('/resume')}
            className="rounded-lg bg-gray-900 px-6 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            홈으로
          </button>
        </div>
      </main>
    </div>
  )
}

export default function ReportPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ReportContent />
    </Suspense>
  )
}
