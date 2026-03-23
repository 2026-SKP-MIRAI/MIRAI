'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ResumeFeedbackResponse, FeedbackScores } from '@/lib/types'
import { getGrade } from '@/lib/grade'
import Spinner from '@/components/Spinner'
import ScoreGauge from '@/components/ScoreGauge'

const SCORE_LABEL_MAP: Record<keyof FeedbackScores, string> = {
  specificity: '서술의 구체성',
  achievementClarity: '성과 수치 명확성',
  logicStructure: '논리 구조',
  roleAlignment: '직무 적합성',
  differentiation: '차별성',
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Spinner />
      <p className="text-sm text-gray-500">진단 결과를 불러오는 중...</p>
    </div>
  )
}

function DiagnosisContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resumeId = searchParams.get('resumeId')

  const [diagnosis, setDiagnosis] = useState<ResumeFeedbackResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!resumeId) {
      router.replace('/dashboard')
      return
    }

    fetch(`/api/resume/diagnosis?resumeId=${encodeURIComponent(resumeId)}`)
      .then((r) => {
        if (!r.ok) {
          router.replace('/dashboard')
          return null
        }
        return r.json()
      })
      .then((data) => {
        if (!data) return
        setDiagnosis(data)
      })
      .catch(() => {
        router.replace('/dashboard')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [resumeId, router])

  if (loading) return <LoadingScreen />
  if (!diagnosis) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-sm text-gray-500">진단 결과를 찾을 수 없습니다.</p>
      <button onClick={() => router.push('/dashboard')} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
        대시보드로 이동
      </button>
    </div>
  )

  const scoreEntries = Object.entries(diagnosis.scores) as [keyof FeedbackScores, number][]
  const avgScore = scoreEntries.length > 0
    ? Math.round(scoreEntries.reduce((sum, [, v]) => sum + v, 0) / scoreEntries.length)
    : 0
  const grade = getGrade(avgScore)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-[57px] z-40 border-b border-gray-100 bg-white/95 backdrop-blur-sm px-4 sm:px-6 py-4 flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-900">서류 강점·약점 진단</h1>
        <button
          onClick={() => router.push('/dashboard')}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          홈으로
        </button>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-8 space-y-6 pb-16">

        {/* 종합 점수 카드 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-5 mb-6">
            <ScoreGauge score={avgScore} />

            <div>
              <p className="text-xs text-gray-400 mb-1">종합 점수</p>
              <span className={`inline-block rounded-full px-4 py-1.5 text-2xl font-extrabold ${grade.bg} ${grade.color}`}>
                {grade.label}
              </span>
              <p className="text-xs text-gray-500 mt-2">등급 {grade.label} · 5개 항목 평균</p>
            </div>
          </div>

          {/* 항목별 점수 바 */}
          <div className="space-y-4">
            {scoreEntries.map(([key, score]) => {
              const isStrong = score >= 70
              return (
                <div key={key}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-medium text-gray-700">{SCORE_LABEL_MAP[key]}</span>
                    <span className={`text-sm font-bold ${isStrong ? 'text-blue-600' : 'text-orange-500'}`}>
                      {score}점
                    </span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-[width] duration-700 ease-out ${isStrong ? 'bg-blue-500' : 'bg-orange-400'}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* 강점 */}
        <section className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-gray-900">강점</h2>
            <span className="rounded-full bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5">
              {diagnosis.strengths.length}개
            </span>
          </div>
          <div className="space-y-3">
            {diagnosis.strengths.map((s, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl bg-blue-50 px-4 py-3">
                <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-gray-700 leading-relaxed">{s}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 약점 */}
        <section className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-orange-400 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-gray-900">약점</h2>
            <span className="rounded-full bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5">
              {diagnosis.weaknesses.length}개
            </span>
          </div>
          <div className="space-y-3">
            {diagnosis.weaknesses.map((w, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl bg-orange-50 px-4 py-3">
                <svg className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-gray-700 leading-relaxed">{w}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 개선 방향 */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-4">개선 방향</h2>
          <div className="space-y-3">
            {diagnosis.suggestions.map((s, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <span className="w-7 h-7 rounded-full bg-[#1a1a2e] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <p className="text-sm font-bold text-gray-900">{s.section}</p>
                      <span className="rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-xs text-orange-600">
                        {s.issue}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{s.suggestion}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  )
}

export default function DiagnosisPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <DiagnosisContent />
    </Suspense>
  )
}
