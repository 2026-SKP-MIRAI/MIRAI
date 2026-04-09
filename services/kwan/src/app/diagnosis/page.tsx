'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { FeedbackScores, SuggestionItem } from '@/domain/interview/types'

interface DiagnosisResult {
  scores: FeedbackScores
  strengths: string[]
  weaknesses: string[]
  suggestions: SuggestionItem[]
}

const SCORE_LABELS: Record<keyof FeedbackScores, string> = {
  specificity: '구체성',
  achievementClarity: '성과 명확성',
  logicStructure: '논리 구조',
  roleAlignment: '직무 정합성',
  differentiation: '차별성',
}

function ScoreTile({ label, score }: { label: string; score: number }) {
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

function DiagnosisPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const resumeId = searchParams.get('resumeId')

  const [result, setResult] = useState<DiagnosisResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!resumeId) {
      router.replace('/upload')
      return
    }

    fetch(`/api/resume/diagnosis?resumeId=${resumeId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else {
          setResult(data)
        }
      })
      .catch(() => setError('진단 결과를 불러오는 중 오류가 발생했습니다.'))
      .finally(() => setLoading(false))
  }, [resumeId, router])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--kwan-bg)' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--kwan-teal)' }} className="animate-pulse">진단 결과 불러오는 중...</p>
      </main>
    )
  }

  if (error || !result) {
    return (
      <main className="min-h-screen flex flex-col items-center py-16 px-4" style={{ background: 'var(--kwan-bg)' }}>
        <div className="w-full max-w-xl">
          <p style={{ fontSize: '0.875rem', color: 'var(--kwan-error)', marginBottom: '1rem' }}>{error ?? '진단 결과를 찾을 수 없습니다.'}</p>
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

  return (
    <main className="min-h-screen flex flex-col items-center py-16 px-4" style={{ background: 'var(--kwan-bg)' }}>
      <div className="w-full max-w-xl flex flex-col gap-8">
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--kwan-text)' }}>자소서 5축 진단</h1>

        {/* 5축 점수 — Bento Score Tiles */}
        <section>
          <p className="section-label mb-3">축별 점수</p>
          <div className="matte-card p-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {(Object.keys(SCORE_LABELS) as (keyof FeedbackScores)[]).map((key) => (
                <ScoreTile key={key} label={SCORE_LABELS[key]} score={result.scores[key]} />
              ))}
            </div>
          </div>
        </section>

        {/* 강점 */}
        {result.strengths.length > 0 && (
          <section className="flex flex-col gap-3">
            <p className="section-label">강점</p>
            {result.strengths.map((s, i) => (
              <div key={i} className="feedback-card success">
                <p style={{ fontSize: '0.875rem', color: 'var(--kwan-text)', lineHeight: 1.65 }}>{s}</p>
              </div>
            ))}
          </section>
        )}

        {/* 약점 */}
        {result.weaknesses.length > 0 && (
          <section className="flex flex-col gap-3">
            <p className="section-label">약점</p>
            {result.weaknesses.map((w, i) => (
              <div key={i} className="feedback-card error">
                <p style={{ fontSize: '0.875rem', color: 'var(--kwan-text)', lineHeight: 1.65 }}>{w}</p>
              </div>
            ))}
          </section>
        )}

        {/* 개선 제안 */}
        {result.suggestions.length > 0 && (
          <section className="flex flex-col gap-3">
            <p className="section-label">개선 제안</p>
            {result.suggestions.map((s, i) => (
              <div key={i} className="feedback-card teal">
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--kwan-teal)', marginBottom: '0.25rem' }}>{s.section}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--kwan-text-2)', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--kwan-text)' }}>문제: </span>{s.issue}
                </p>
                <p style={{ fontSize: '0.875rem', color: 'var(--kwan-text-2)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--kwan-text)' }}>제안: </span>{s.suggestion}
                </p>
              </div>
            ))}
          </section>
        )}

        <button
          onClick={() => router.push(`/interview?resumeId=${encodeURIComponent(resumeId ?? '')}`)}
          className="btn-primary w-full"
          style={{ padding: '0.875rem', fontSize: '0.9375rem' }}
        >
          면접 시작
        </button>

        <button
          onClick={() => router.replace('/upload')}
          style={{ fontSize: '0.875rem', color: 'var(--kwan-text-2)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}
        >
          처음으로
        </button>
      </div>
    </main>
  )
}

export default function DiagnosisPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--kwan-bg)' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--kwan-teal)' }} className="animate-pulse">로딩 중...</p>
      </main>
    }>
      <DiagnosisPageInner />
    </Suspense>
  )
}
