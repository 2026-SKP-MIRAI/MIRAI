'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import ScoreGauge from '@/components/ScoreGauge'
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

function ScoreTile({ label, score }: { label: string; score: number | null }) {
  if (score === null) {
    return (
      <div className="score-tile">
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--kwan-text-2)' }}>{label}</p>
        <p className="score-tile-value" style={{ color: 'var(--kwan-text-muted)', fontSize: '1.5rem' }}>—</p>
        <div className="score-tile-bar-track">
          <div className="score-tile-bar-fill" style={{ width: '0%' }} />
        </div>
      </div>
    )
  }
  return (
    <div className="score-tile">
      <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--kwan-text-2)' }}>{label}</p>
      <p className="score-tile-value" style={{ color: score >= 80 ? 'var(--kwan-teal)' : score >= 60 ? 'var(--kwan-amber)' : 'var(--kwan-error)' }}>
        {score}
      </p>
      <div className="score-tile-bar-track">
        <div
          className={`score-tile-bar-fill ${score >= 80 ? 'high' : score >= 60 ? 'mid' : 'low'}`}
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
      router.replace('/dashboard')
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
      <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--kwan-bg)' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--kwan-teal)' }} className="animate-pulse">리포트 생성 중... (약 30~60초 소요)</p>
      </main>
    )
  }

  if (error || !report) {
    return (
      <main className="min-h-screen flex flex-col items-center py-16 px-4" style={{ background: 'var(--kwan-bg)' }}>
        <div className="w-full max-w-xl">
          <p style={{ fontSize: '0.875rem', color: 'var(--kwan-error)', marginBottom: '1rem' }}>{error ?? '리포트를 찾을 수 없습니다.'}</p>
          <button
            onClick={() => router.replace('/dashboard')}
            style={{ fontSize: '0.875rem', color: 'var(--kwan-text-2)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            처음으로
          </button>
        </div>
      </main>
    )
  }

  const strengthFeedbacks = report.axisFeedbacks.filter((f) => f.type === 'strength')
  const improveFeedbacks = report.axisFeedbacks.filter((f) => f.type === 'improvement')
  const notEvaluatedFeedbacks = report.axisFeedbacks.filter((f) => f.type === 'not_evaluated')

  return (
    <main className="min-h-screen flex flex-col items-center py-16 px-4" style={{ background: 'var(--kwan-bg)' }}>
      <div className="w-full max-w-xl flex flex-col gap-8">
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--kwan-text)' }}>8축 역량 리포트</h1>

        {/* 총점 — ScoreGauge */}
        <section className="matte-card p-6 flex flex-col items-center gap-2">
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--kwan-teal)' }}>종합 점수</p>
          <ScoreGauge score={report.totalScore} />
        </section>

        {/* 8축 점수 — Bento Score Tiles */}
        <section>
          <p className="section-label mb-3">축별 점수</p>
          <div className="matte-card p-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(Object.keys(AXIS_LABELS) as (keyof AxisScores)[]).map((key) => (
                <ScoreTile key={key} label={AXIS_LABELS[key]} score={report.scores[key]} />
              ))}
            </div>
          </div>
        </section>

        {/* 종합 요약 */}
        <section className="matte-card p-6 flex flex-col gap-2">
          <p className="section-label mb-1">종합 평가</p>
          <p style={{ fontSize: '0.9375rem', color: 'var(--kwan-text-2)', lineHeight: 1.75 }}>{report.summary}</p>
        </section>

        {/* 강점 피드백 */}
        {strengthFeedbacks.length > 0 && (
          <section className="flex flex-col gap-3">
            <p className="section-label">강점 영역</p>
            {strengthFeedbacks.map((f, i) => (
              <div key={i} className="feedback-card success">
                <div className="flex items-center justify-between mb-1">
                  <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--kwan-success)' }}>{f.axisLabel}</p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--kwan-success)', fontWeight: 600 }}>{f.score != null ? `${f.score}점` : '-'}</span>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--kwan-text-2)', lineHeight: 1.65 }}>{f.feedback}</p>
              </div>
            ))}
          </section>
        )}

        {/* 개선 피드백 */}
        {improveFeedbacks.length > 0 && (
          <section className="flex flex-col gap-3">
            <p className="section-label">개선 영역</p>
            {improveFeedbacks.map((f, i) => (
              <div key={i} className="feedback-card warning">
                <div className="flex items-center justify-between mb-1">
                  <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--kwan-amber)' }}>{f.axisLabel}</p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--kwan-amber)', fontWeight: 600 }}>{f.score != null ? `${f.score}점` : '-'}</span>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--kwan-text-2)', lineHeight: 1.65 }}>{f.feedback}</p>
              </div>
            ))}
          </section>
        )}

        {/* 미평가 영역 */}
        {notEvaluatedFeedbacks.length > 0 && (
          <section className="flex flex-col gap-3">
            <p className="section-label">미평가 영역</p>
            {notEvaluatedFeedbacks.map((f, i) => (
              <div key={i} className="feedback-card muted">
                <div className="flex items-center justify-between mb-1">
                  <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--kwan-text)' }}>{f.axisLabel}</p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--kwan-text-muted)', fontWeight: 600 }}>미평가</span>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--kwan-text-2)', lineHeight: 1.65 }}>{f.feedback}</p>
              </div>
            ))}
          </section>
        )}

        <button
          onClick={() => router.replace('/dashboard')}
          className="btn-outline"
          style={{ padding: '0.75rem 1.5rem', fontSize: '0.9375rem', alignSelf: 'flex-start' }}
        >
          대시보드로
        </button>
      </div>
    </main>
  )
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--kwan-bg)' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--kwan-teal)' }} className="animate-pulse">리포트 생성 중... (약 30~60초 소요)</p>
      </main>
    }>
      <ReportPageInner />
    </Suspense>
  )
}
