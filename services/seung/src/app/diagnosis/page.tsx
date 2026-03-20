'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ResumeFeedbackResponse, FeedbackScores } from '@/lib/types'

const SCORE_LABEL_MAP: Record<keyof FeedbackScores, string> = {
  specificity: '서술의 구체성',
  achievementClarity: '성과 수치 명확성',
  logicStructure: '논리 구조',
  roleAlignment: '직무 적합성',
  differentiation: '차별성',
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">진단 결과를 불러오는 중...</p>
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
      router.replace('/resume')
      return
    }

    fetch(`/api/resume/diagnosis?resumeId=${encodeURIComponent(resumeId)}`)
      .then((r) => {
        if (!r.ok) {
          router.replace('/resume')
          return null
        }
        return r.json()
      })
      .then((data) => {
        if (!data) return
        setDiagnosis(data)
      })
      .catch(() => {
        router.replace('/resume')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [resumeId, router])

  if (loading) return <LoadingScreen />
  if (!diagnosis) return null

  const scoreEntries = Object.entries(diagnosis.scores) as [keyof FeedbackScores, number][]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-lg font-bold text-gray-900">MirAI — 서류 강점·약점 진단</h1>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8 space-y-8">
        {/* 5개 항목 점수 */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">항목별 점수</h2>
          <div className="space-y-3">
            {scoreEntries.map(([key, score]) => {
              const isStrong = score >= 70
              const colorClass = isStrong
                ? { text: 'text-blue-600', bar: 'bg-blue-500' }
                : { text: 'text-orange-500', bar: 'bg-orange-400' }
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">
                      {SCORE_LABEL_MAP[key] ?? key}
                    </span>
                    <span className={`font-semibold ${colorClass.text}`}>{score}</span>
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

        {/* 강점 */}
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-3">강점</h2>
          <ul className="space-y-2">
            {diagnosis.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-0.5 text-blue-500">✓</span>
                {s}
              </li>
            ))}
          </ul>
        </section>

        {/* 약점 */}
        <section className="rounded-xl border border-orange-200 bg-orange-50 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-3">약점</h2>
          <ul className="space-y-2">
            {diagnosis.weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-0.5 text-orange-500">!</span>
                {w}
              </li>
            ))}
          </ul>
        </section>

        {/* 개선 방향 */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">개선 방향</h2>
          {diagnosis.suggestions.map((s, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-800 mb-1">{s.section}</p>
              <p className="text-xs text-orange-600 mb-2">{s.issue}</p>
              <p className="text-sm text-gray-700">{s.suggestion}</p>
            </div>
          ))}
        </section>

        {/* 홈으로 */}
        <div className="flex justify-center pb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="rounded-lg bg-gray-900 px-6 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            홈으로
          </button>
        </div>
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
