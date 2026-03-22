'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { AxisScores, AxisFeedback } from '@/domain/interview/types'

interface ReportData {
  id: string
  totalScore: number
  scores: AxisScores
  summary: string
  axisFeedbacks: AxisFeedback[]
  createdAt: string
}

const AXIS_LABELS: Record<keyof AxisScores, string> = {
  communication: '의사소통',
  problemSolving: '문제해결',
  logicalThinking: '논리적 사고',
  jobExpertise: '직무 전문성',
  cultureFit: '조직 적합성',
  leadership: '리더십',
  creativity: '창의성',
  sincerity: '성실성',
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 80 ? 'bg-indigo-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-400'
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-700">{label}</span>
        <span className="font-semibold text-gray-900">{score}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${color} transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

function ReportPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const reportId = searchParams.get('reportId')

  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!reportId) {
      router.replace('/')
      return
    }

    fetch(`/api/report?reportId=${reportId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else {
          setReport(data)
        }
      })
      .catch(() => setError('리포트를 불러오는 중 오류가 발생했습니다.'))
      .finally(() => setLoading(false))
  }, [reportId, router])

  if (loading) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-indigo-600 animate-pulse">리포트 생성 중... (약 15초 소요)</p>
      </main>
    )
  }

  if (error || !report) {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center py-16 px-4">
        <div className="w-full max-w-xl">
          <p className="text-sm text-red-600 mb-4">{error ?? '리포트를 찾을 수 없습니다.'}</p>
          <button
            onClick={() => router.replace('/')}
            className="text-sm text-gray-500 underline hover:text-gray-700"
          >
            처음으로
          </button>
        </div>
      </main>
    )
  }

  const strengthFeedbacks = report.axisFeedbacks.filter((f) => f.type === 'strength')
  const improveFeedbacks = report.axisFeedbacks.filter((f) => f.type === 'improvement')

  return (
    <main className="min-h-screen bg-white flex flex-col items-center py-16 px-4">
      <div className="w-full max-w-xl flex flex-col gap-8">
        <h1 className="text-2xl font-bold text-gray-900">8축 역량 리포트</h1>

        {/* 총점 */}
        <section className="flex flex-col items-center gap-2 py-6 bg-indigo-50 rounded-xl">
          <p className="text-sm text-indigo-600 font-medium">종합 점수</p>
          <p className="text-6xl font-bold text-indigo-700">{report.totalScore}</p>
          <p className="text-sm text-indigo-500">/ 100</p>
        </section>

        {/* 8축 점수 바 */}
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-bold text-gray-700">축별 점수</h2>
          {(Object.keys(AXIS_LABELS) as (keyof AxisScores)[]).map((key) => (
            <ScoreBar key={key} label={AXIS_LABELS[key]} score={report.scores[key]} />
          ))}
        </section>

        {/* 종합 요약 */}
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-bold text-gray-700">종합 평가</h2>
          <p className="text-sm text-gray-700 leading-relaxed">{report.summary}</p>
        </section>

        {/* 강점 피드백 */}
        {strengthFeedbacks.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold text-gray-700">강점 영역</h2>
            {strengthFeedbacks.map((f, i) => (
              <div key={i} className="p-4 bg-green-50 border border-green-200 rounded-lg flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-green-800">{f.axisLabel}</p>
                  <span className="text-xs text-green-600 font-medium">{f.score}점</span>
                </div>
                <p className="text-sm text-green-700">{f.feedback}</p>
              </div>
            ))}
          </section>
        )}

        {/* 개선 피드백 */}
        {improveFeedbacks.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold text-gray-700">개선 영역</h2>
            {improveFeedbacks.map((f, i) => (
              <div key={i} className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-amber-800">{f.axisLabel}</p>
                  <span className="text-xs text-amber-600 font-medium">{f.score}점</span>
                </div>
                <p className="text-sm text-amber-700">{f.feedback}</p>
              </div>
            ))}
          </section>
        )}

        <button
          onClick={() => router.replace('/')}
          className="py-2 px-6 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors self-start"
        >
          처음으로
        </button>
      </div>
    </main>
  )
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-indigo-600 animate-pulse">리포트 생성 중... (약 15초 소요)</p>
      </main>
    }>
      <ReportPageInner />
    </Suspense>
  )
}
