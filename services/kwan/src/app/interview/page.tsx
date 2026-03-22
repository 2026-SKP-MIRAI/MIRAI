'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import InterviewChat from '@/components/InterviewChat'
import type { QuestionWithPersona, HistoryItem, InterviewMode } from '@/domain/interview/types'
type Step = 'mode-select' | 'loading' | 'chatting'

interface SessionState {
  sessionId: string
  firstQuestion: QuestionWithPersona
  history: HistoryItem[]
  interviewMode: InterviewMode
  sessionComplete: boolean
}

function InterviewPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const resumeId = searchParams.get('resumeId')
  const sessionId = searchParams.get('sessionId')

  const [step, setStep] = useState<Step>(sessionId ? 'loading' : 'mode-select')
  const [sessionState, setSessionState] = useState<SessionState | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 기존 sessionId로 접근 시 (페이지 새로고침 등) — 세션 직접 로드
  useEffect(() => {
    if (!sessionId || step !== 'loading') return

    fetch(`/api/interview/session?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); setStep('mode-select'); return }
        setSessionState({
          sessionId: data.sessionId,
          firstQuestion: {
            persona: data.currentPersona,
            personaLabel: data.currentPersonaLabel,
            question: data.currentQuestion,
            type: data.currentQuestionType,
          },
          history: data.history ?? [],
          interviewMode: data.interviewMode ?? 'real',
          sessionComplete: data.sessionComplete,
        })
        setStep('chatting')
      })
      .catch(() => { setError('세션을 불러오는 중 오류가 발생했습니다.'); setStep('mode-select') })
  }, [sessionId, step])

  async function handleModeSelect(mode: InterviewMode) {
    if (!resumeId) return
    setStep('loading')
    setError(null)
    try {
      const res = await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId, mode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '면접 시작 중 오류가 발생했습니다.')
        setStep('mode-select')
        return
      }
      setSessionState({
        sessionId: data.sessionId,
        firstQuestion: data.firstQuestion,
        history: [],
        interviewMode: mode,
        sessionComplete: false,
      })
      setStep('chatting')
    } catch {
      setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
      setStep('mode-select')
    }
  }

  if (step === 'loading') {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-blue-600 animate-pulse">면접 준비 중...</p>
      </main>
    )
  }

  if (step === 'mode-select') {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md flex flex-col gap-6">
          <h1 className="text-2xl font-bold text-gray-900 text-center">면접 모드 선택</h1>
          <p className="text-sm text-gray-500 text-center">원하는 면접 방식을 선택해주세요.</p>
          {error && <p className="text-sm text-red-600 text-center" role="alert">{error}</p>}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleModeSelect('real')}
              className="w-full py-4 rounded-xl border-2 border-blue-600 bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
            >
              실전 모드
              <span className="block text-xs font-normal opacity-80 mt-1">피드백 없이 실제 면접처럼 진행</span>
            </button>
            <button
              onClick={() => handleModeSelect('practice')}
              className="w-full py-4 rounded-xl border-2 border-indigo-400 text-indigo-700 font-semibold hover:bg-indigo-50 transition-colors"
            >
              연습 모드
              <span className="block text-xs font-normal opacity-80 mt-1">답변마다 즉각 피드백 + 재답변</span>
            </button>
          </div>
          <button
            onClick={() => router.replace('/')}
            className="text-sm text-gray-500 underline hover:text-gray-700 text-center"
          >
            처음으로
          </button>
        </div>
      </main>
    )
  }

  if (!sessionState) {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center py-16 px-4">
        <div className="w-full max-w-xl">
          <p className="text-sm text-red-600 mb-4">{error ?? '세션을 찾을 수 없습니다.'}</p>
          <button onClick={() => router.replace('/')} className="text-sm text-gray-500 underline hover:text-gray-700">
            처음으로
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center py-16 px-4">
      <div className="w-full max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">
          {sessionState.interviewMode === 'practice' ? '연습 면접' : '패널 면접'}
        </h1>
        <InterviewChat
          sessionId={sessionState.sessionId}
          initialQuestion={sessionState.firstQuestion}
          initialHistory={sessionState.history}
          initialComplete={sessionState.sessionComplete}
          interviewMode={sessionState.interviewMode}
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
