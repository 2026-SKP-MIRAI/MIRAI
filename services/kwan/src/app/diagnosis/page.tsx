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

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-400'
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

function DiagnosisPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const resumeId = searchParams.get('resumeId')

  const [result, setResult] = useState<DiagnosisResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!resumeId) {
      router.replace('/')
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
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-indigo-600 animate-pulse">진단 결과 불러오는 중...</p>
      </main>
    )
  }

  if (error || !result) {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center py-16 px-4">
        <div className="w-full max-w-xl">
          <p className="text-sm text-red-600 mb-4">{error ?? '진단 결과를 찾을 수 없습니다.'}</p>
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

  return (
    <main className="min-h-screen bg-white flex flex-col items-center py-16 px-4">
      <div className="w-full max-w-xl flex flex-col gap-8">
        <h1 className="text-2xl font-bold text-gray-900">자소서 5축 진단</h1>

        {/* 5축 점수 바 */}
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-bold text-gray-700">축별 점수</h2>
          {(Object.keys(SCORE_LABELS) as (keyof FeedbackScores)[]).map((key) => (
            <ScoreBar key={key} label={SCORE_LABELS[key]} score={result.scores[key]} />
          ))}
        </section>

        {/* 강점 */}
        {result.strengths.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-base font-bold text-gray-700">강점</h2>
            <ul className="flex flex-col gap-1">
              {result.strengths.map((s, i) => (
                <li key={i} className="px-3 py-1.5 bg-green-50 text-green-800 text-sm rounded">
                  {s}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 약점 */}
        {result.weaknesses.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-base font-bold text-gray-700">약점</h2>
            <ul className="flex flex-col gap-1">
              {result.weaknesses.map((w, i) => (
                <li key={i} className="px-3 py-1.5 bg-red-50 text-red-800 text-sm rounded">
                  {w}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 개선 제안 */}
        {result.suggestions.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold text-gray-700">개선 제안</h2>
            {result.suggestions.map((s, i) => (
              <div key={i} className="p-4 border border-gray-200 rounded-lg flex flex-col gap-1">
                <p className="text-xs font-semibold text-indigo-600">{s.section}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">문제: </span>{s.issue}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">제안: </span>{s.suggestion}</p>
              </div>
            ))}
          </section>
        )}

        <button
          onClick={() => router.push(`/interview?resumeId=${resumeId}`)}
          className="w-full bg-blue-600 text-white rounded-md py-3 text-sm font-semibold hover:bg-blue-700"
        >
          면접 시작
        </button>

        <button
          onClick={() => router.replace('/')}
          className="text-sm text-gray-500 underline hover:text-gray-700 self-start"
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
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-indigo-600 animate-pulse">로딩 중...</p>
      </main>
    }>
      <DiagnosisPageInner />
    </Suspense>
  )
}
