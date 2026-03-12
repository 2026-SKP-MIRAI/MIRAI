'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import InterviewChat from '@/components/InterviewChat'
import type { HistoryItem, QuestionWithPersona } from '@/domain/interview/types'

interface SessionData {
  sessionId: string
  history: HistoryItem[]
  currentQuestion: string
  currentPersona: string
  currentPersonaLabel: string
  currentQuestionType: 'main' | 'follow_up'
  sessionComplete: boolean
}

function InterviewPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('sessionId')

  const [session, setSession] = useState<SessionData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) {
      router.replace('/')
      return
    }

    fetch(`/api/interview/session?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else {
          setSession(data)
        }
      })
      .catch(() => setError('세션을 불러오는 중 오류가 발생했습니다.'))
      .finally(() => setLoading(false))
  }, [sessionId, router])

  if (loading) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-blue-600 animate-pulse">면접 준비 중...</p>
      </main>
    )
  }

  if (error || !session) {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center py-16 px-4">
        <div className="w-full max-w-xl">
          <p className="text-sm text-red-600 mb-4">{error ?? '세션을 찾을 수 없습니다.'}</p>
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

  const initialQuestion: QuestionWithPersona = {
    persona: session.currentPersona as QuestionWithPersona['persona'],
    personaLabel: session.currentPersonaLabel,
    question: session.currentQuestion,
    type: session.currentQuestionType,
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center py-16 px-4">
      <div className="w-full max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">패널 면접</h1>
        <InterviewChat
          sessionId={session.sessionId}
          initialQuestion={initialQuestion}
          initialHistory={session.history}
          initialComplete={session.sessionComplete}
          onComplete={() => router.replace('/')}
        />
      </div>
    </main>
  )
}

export default function InterviewPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-blue-600 animate-pulse">로딩 중...</p>
      </main>
    }>
      <InterviewPageInner />
    </Suspense>
  )
}
