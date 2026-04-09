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
  totalQuestions?: number
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
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (data.error) { setError(data.error); setStep('mode-select'); return }
        const firstQuestion = {
          persona: data.currentPersona,
          personaLabel: data.currentPersonaLabel,
          question: data.currentQuestion,
          type: data.currentQuestionType,
        }
        if (!firstQuestion.question) {
          setError('세션 데이터를 불러올 수 없습니다.')
          setStep('mode-select')
          return
        }
        setSessionState({
          sessionId: data.sessionId,
          firstQuestion,
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
        totalQuestions: data.totalQuestions,
      })
      setStep('chatting')
    } catch {
      setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
      setStep('mode-select')
    }
  }

  if (step === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--kwan-bg)' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--kwan-teal)' }} className="animate-pulse">면접 준비 중...</p>
      </main>
    )
  }

  if (step === 'mode-select') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: 'var(--kwan-bg)' }}>
        <div className="w-full max-w-md flex flex-col gap-6">
          <div className="text-center">
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--kwan-text)' }}>면접 모드 선택</h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--kwan-text-2)', marginTop: '0.5rem' }}>원하는 면접 방식을 선택해주세요.</p>
          </div>
          {error && (
            <p style={{ fontSize: '0.875rem', color: 'var(--kwan-error)', textAlign: 'center' }} role="alert">{error}</p>
          )}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleModeSelect('real')}
              className="matte-card matte-card-hover w-full py-5 px-6 text-left"
              style={{ borderLeft: '3px solid var(--kwan-teal)', cursor: 'pointer', border: '1px solid var(--kwan-border)', borderLeftWidth: '3px', borderLeftColor: 'var(--kwan-teal)' }}
            >
              <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--kwan-text)', display: 'block' }}>실전 모드</span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--kwan-text-2)', marginTop: '0.25rem', display: 'block' }}>피드백 없이 실제 면접처럼 진행</span>
            </button>
            <button
              onClick={() => handleModeSelect('practice')}
              className="matte-card matte-card-hover w-full py-5 px-6 text-left"
              style={{ borderLeft: '3px solid var(--kwan-amber)', cursor: 'pointer', border: '1px solid var(--kwan-border)', borderLeftWidth: '3px', borderLeftColor: 'var(--kwan-amber)' }}
            >
              <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--kwan-text)', display: 'block' }}>연습 모드</span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--kwan-text-2)', marginTop: '0.25rem', display: 'block' }}>답변마다 즉각 피드백 + 재답변</span>
            </button>
          </div>
          <button
            onClick={() => router.replace('/upload')}
            style={{ fontSize: '0.875rem', color: 'var(--kwan-text-2)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center' }}
          >
            처음으로
          </button>
        </div>
      </main>
    )
  }

  if (!sessionState) {
    return (
      <main className="min-h-screen flex flex-col items-center py-16 px-4" style={{ background: 'var(--kwan-bg)' }}>
        <div className="w-full max-w-xl">
          <p style={{ fontSize: '0.875rem', color: 'var(--kwan-error)', marginBottom: '1rem' }}>{error ?? '세션을 찾을 수 없습니다.'}</p>
          <button
            onClick={() => router.replace('/upload')}
            style={{ fontSize: '0.875rem', color: 'var(--kwan-text-2)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            처음으로
          </button>
        </div>
      </main>
    )
  }

  if (!sessionState.firstQuestion?.question) {
    return (
      <main className="min-h-screen flex flex-col items-center py-16 px-4" style={{ background: 'var(--kwan-bg)' }}>
        <div className="w-full max-w-xl">
          <p style={{ fontSize: '0.875rem', color: 'var(--kwan-error)', marginBottom: '1rem' }}>세션 데이터를 불러올 수 없습니다.</p>
          <button
            onClick={() => router.replace('/upload')}
            style={{ fontSize: '0.875rem', color: 'var(--kwan-text-2)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            처음으로
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center py-10 px-4" style={{ background: 'var(--kwan-bg)' }}>
      <div className="w-full max-w-2xl">
        <InterviewChat
          sessionId={sessionState.sessionId}
          initialQuestion={sessionState.firstQuestion}
          initialHistory={sessionState.history}
          initialComplete={sessionState.sessionComplete}
          interviewMode={sessionState.interviewMode}
          totalQuestions={sessionState.totalQuestions}
          onComplete={() => router.replace('/dashboard')}
        />
      </div>
    </main>
  )
}

export default function InterviewPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--kwan-bg)' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--kwan-teal)' }} className="animate-pulse">로딩 중...</p>
      </main>
    }>
      <InterviewPageInner />
    </Suspense>
  )
}
