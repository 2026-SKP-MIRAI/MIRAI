'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ReportResponse } from '@/lib/types'
import { getGrade } from '@/lib/grade'

function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <svg className="h-8 w-8 animate-spin text-[#4361ee]" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      <p className="text-sm text-gray-500">리포트를 불러오는 중...</p>
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
      router.replace('/dashboard')
      return
    }

    fetch(`/api/report?reportId=${encodeURIComponent(reportId)}`)
      .then((r) => {
        if (!r.ok) {
          router.replace('/dashboard')
          return null
        }
        return r.json()
      })
      .then((data) => {
        if (!data) return
        setReport(data)
      })
      .catch(() => {
        router.replace('/dashboard')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [reportId, router])

  if (loading) return <LoadingScreen />
  if (!report) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-sm text-gray-500">리포트를 찾을 수 없습니다.</p>
      <button onClick={() => router.push('/dashboard')} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
        대시보드로 이동
      </button>
    </div>
  )

  const scoreEntries = Object.entries(report.scores ?? {}) as [string, number][]
  const grade = getGrade(report.totalScore)
  const strengths = (report.axisFeedbacks ?? []).filter(fb => fb.type === 'strength')
  const improvements = (report.axisFeedbacks ?? []).filter(fb => fb.type === 'improvement')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-[57px] z-40 border-b border-gray-100 bg-white/95 backdrop-blur-sm px-4 sm:px-6 py-4 flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-900">역량 평가 리포트</h1>
        <button
          onClick={() => router.push('/dashboard')}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          홈으로
        </button>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-8 space-y-6 pb-16">

        {/* 종합 요약 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">종합 요약</h2>
          <p className="text-gray-700 leading-relaxed text-sm">{report.summary}</p>
        </section>

        {/* 총점 + 8축 점수 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {/* 점수 헤더 */}
          <div className="flex items-center gap-5 mb-6">
            <div className="relative w-24 h-24 shrink-0">
              <svg viewBox="0 0 96 96" className="w-24 h-24 -rotate-90">
                <circle cx="48" cy="48" r="38" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                <circle
                  cx="48" cy="48" r="38"
                  fill="none"
                  stroke={report.totalScore >= 80 ? '#10b981' : report.totalScore >= 60 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 38}
                  strokeDashoffset={2 * Math.PI * 38 * (1 - report.totalScore / 100)}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="text-2xl font-extrabold leading-none"
                  style={{ color: report.totalScore >= 80 ? '#10b981' : report.totalScore >= 60 ? '#f59e0b' : '#ef4444' }}
                >
                  {report.totalScore}
                </span>
                <span className="text-xs text-gray-400 mt-0.5">/ 100</span>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-1">종합 점수</p>
              <span className={`inline-block rounded-full px-4 py-1.5 text-2xl font-extrabold ${grade.bg} ${grade.color}`}>
                {grade.label}
              </span>
              <p className="text-xs text-gray-500 mt-2">등급 {grade.label} · 8개 역량 축 평균</p>
            </div>
          </div>

          {/* 8축 점수 바 */}
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">역량 축별 점수</h2>
          <div className="space-y-4">
            {scoreEntries.map(([axis, score]) => {
              const feedback = (report.axisFeedbacks ?? []).find(f => f.axis === axis)
              const isStrength = feedback?.type === 'strength'
              const isImprovement = feedback?.type === 'improvement'
              const barColor = isStrength ? 'bg-blue-500' : isImprovement ? 'bg-orange-400' : 'bg-gray-400'
              const textColor = isStrength ? 'text-blue-600' : isImprovement ? 'text-orange-500' : 'text-gray-600'
              return (
                <div key={axis}>
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">
                        {AXIS_LABEL_MAP[axis] ?? axis}
                      </span>
                      {isStrength && (
                        <span className="text-xs rounded-full bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-blue-600 font-medium">강점</span>
                      )}
                      {isImprovement && (
                        <span className="text-xs rounded-full bg-orange-50 border border-orange-200 px-1.5 py-0.5 text-orange-600 font-medium">개선</span>
                      )}
                    </div>
                    <span className={`text-sm font-bold ${textColor}`}>{score}점</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-[width] duration-700 ease-out ${barColor}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* 강점 피드백 */}
        {strengths.length > 0 && (
          <section className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-base font-bold text-gray-900">강점 역량</h2>
              <span className="rounded-full bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5">{strengths.length}개</span>
            </div>
            <div className="space-y-3">
              {strengths.map(fb => (
                <div key={fb.axis} className="rounded-xl bg-blue-50 px-4 py-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-gray-900">{fb.axisLabel}</span>
                    <span className="text-sm font-bold text-blue-600">{fb.score}점</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{fb.feedback}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 개선 필요 피드백 */}
        {improvements.length > 0 && (
          <section className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-orange-400 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                </svg>
              </div>
              <h2 className="text-base font-bold text-gray-900">개선 필요 역량</h2>
              <span className="rounded-full bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5">{improvements.length}개</span>
            </div>
            <div className="space-y-3">
              {improvements.map(fb => (
                <div key={fb.axis} className="rounded-xl bg-orange-50 px-4 py-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-gray-900">{fb.axisLabel}</span>
                    <span className="text-sm font-bold text-orange-500">{fb.score}점</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{fb.feedback}</p>
                </div>
              ))}
            </div>
          </section>
        )}

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
