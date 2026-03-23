'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import InterviewChat from '@/components/InterviewChat'
import AnswerInput from '@/components/AnswerInput'
import Spinner from '@/components/Spinner'
import type { QuestionWithPersona, PracticeFeedbackResponse } from '@/lib/types'

type Message =
  | { id: string; type: 'question'; data: QuestionWithPersona }
  | { id: string; type: 'answer'; text: string }

function InterviewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId')

  const [messages, setMessages] = useState<Message[]>([])
  const [sessionComplete, setSessionComplete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [interviewMode, setInterviewMode] = useState<'real' | 'practice'>('real')
  const [practiceStep, setPracticeStep] = useState<'idle' | 'feedback' | 'retry' | 'done'>('idle')
  const [currentAnswer, setCurrentAnswer] = useState<string>('')
  const [practiceFeedback, setPracticeFeedback] = useState<PracticeFeedbackResponse | null>(null)
  const [practiceSubmitting, setPracticeSubmitting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const submittingRef = useRef(false)
  const msgIdRef = useRef(0)
  const nextMsgId = () => `msg-${++msgIdRef.current}`

  useEffect(() => {
    if (!sessionId) {
      router.replace('/dashboard')
      return
    }

    // interviewMode URL param 읽기
    const mode = searchParams.get('interviewMode')
    if (mode === 'practice') setInterviewMode('practice')

    fetch(`/api/interview/session?${new URLSearchParams({ sessionId })}`)
      .then((r) => {
        if (!r.ok) {
          router.replace('/dashboard')
          return null
        }
        return r.json()
      })
      .then((data) => {
        if (!data) return
        const initialMessages: Message[] = []
        for (const h of data.history ?? []) {
          initialMessages.push({
            id: nextMsgId(),
            type: 'question',
            data: {
              persona: h.persona,
              personaLabel: h.personaLabel,
              question: h.question,
              type: (h.questionType ?? 'main') as 'main' | 'follow_up',
            },
          })
          initialMessages.push({ id: nextMsgId(), type: 'answer', text: h.answer })
        }
        if (!data.sessionComplete) {
          const persona = data.currentPersona ?? 'hr'
          initialMessages.push({
            id: nextMsgId(),
            type: 'question',
            data: {
              persona,
              personaLabel: data.currentPersonaLabel,
              question: data.currentQuestion,
              type: (data.currentQuestionType ?? 'main') as 'main' | 'follow_up',
            },
          })
        }
        setMessages(initialMessages)
        setSessionComplete(data.sessionComplete ?? false)
        setTotalQuestions(data.totalQuestions ?? 0)
        setFileName(data.fileName ?? null)
        // URL param 없이 접근(새로고침 등)할 때 session DB 값으로 복원
        if (data.interviewMode === 'practice') setInterviewMode('practice')
        setLoading(false)
      })
      .catch(() => {
        router.replace('/dashboard')
      })
  }, [sessionId, router, searchParams])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!sessionComplete) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [sessionComplete])

  const handleRealAnswer = async (answer: string) => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setSubmitError(null)
    setMessages((prev) => [...prev, { id: nextMsgId(), type: 'answer', text: answer }])

    try {
      const res = await fetch('/api/interview/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, answer }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessages((prev) => prev.slice(0, -1))
        setSubmitError(data?.error ?? '답변 제출에 실패했습니다. 다시 시도해 주세요.')
        return
      }
      if (data.nextQuestion) {
        setMessages((prev) => [...prev, { id: nextMsgId(), type: 'question', data: data.nextQuestion }])
      }
      if (data.sessionComplete) {
        setSessionComplete(true)
      }
    } catch {
      setMessages((prev) => prev.slice(0, -1))
      setSubmitError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handlePracticeFeedback = async (answer: string) => {
    if (practiceSubmitting) return
    const isRetry = practiceStep === 'retry'

    // 현재 질문 추출 (마지막 question 메시지)
    const lastQuestion = [...messages].reverse().find((m) => m.type === 'question')
    if (!lastQuestion || lastQuestion.type !== 'question') return
    const currentQuestion = lastQuestion.data.question

    setPracticeSubmitting(true)
    setSubmitError(null)
    setMessages((prev) => [...prev, { id: nextMsgId(), type: 'answer', text: answer }])

    try {
      const body: Record<string, string> = { question: currentQuestion, answer }
      if (isRetry) body.previousAnswer = currentAnswer

      const res = await fetch('/api/practice/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessages((prev) => prev.slice(0, -1))
        setSubmitError(data?.error ?? '피드백 요청에 실패했습니다. 다시 시도해 주세요.')
        return
      }

      setPracticeFeedback(data)
      if (isRetry) {
        setPracticeStep('done')
      } else {
        setCurrentAnswer(answer)
        setPracticeStep('feedback')
      }
    } catch {
      setMessages((prev) => prev.slice(0, -1))
      setSubmitError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.')
    } finally {
      setPracticeSubmitting(false)
    }
  }

  const handleSubmit = async (answer: string) => {
    if (interviewMode === 'practice') {
      await handlePracticeFeedback(answer)
    } else {
      await handleRealAnswer(answer)
    }
  }

  const handleNextQuestion = async () => {
    const finalAnswer = practiceStep === 'done'
      ? (messages.filter((m) => m.type === 'answer').slice(-1)[0] as { id: string; type: 'answer'; text: string } | undefined)?.text ?? currentAnswer
      : currentAnswer

    // 상태 초기화
    setPracticeStep('idle')
    setPracticeFeedback(null)
    setCurrentAnswer('')

    await handleRealAnswer(finalAnswer)
  }

  const handleRetry = () => {
    // AnswerInput을 다시 보이게 하기 위해 practiceStep을 'retry'로
    setPracticeStep('retry')
  }

  const handleReport = async () => {
    if (!sessionId) return
    setIsGeneratingReport(true)
    setReportError(null)
    try {
      const res = await fetch('/api/report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setReportError(data?.error ?? '리포트 생성에 실패했습니다. 다시 시도해 주세요.')
        return
      }
      router.push(`/report?reportId=${data.reportId}`)
    } catch {
      setReportError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.')
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const handleRestart = () => {
    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Spinner />
        <p className="text-sm text-gray-500">면접을 불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-100 bg-white/95 backdrop-blur-sm sticky top-[57px] z-40 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900">패널 면접</h1>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            interviewMode === 'practice'
              ? 'bg-green-100 text-green-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {interviewMode === 'practice' ? '연습 모드' : '실전 모드'}
          </span>
          {fileName && (
            <p className="text-xs text-gray-400">{fileName}</p>
          )}
        </div>
        <button
          onClick={() => {
            if (!sessionComplete && window.confirm('면접이 진행 중입니다. 나가시겠습니까?')) {
              router.push('/dashboard')
            } else if (sessionComplete) {
              router.push('/dashboard')
            }
          }}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          나가기
        </button>
      </header>
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-6 space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <InterviewChat
            messages={messages}
            sessionComplete={sessionComplete}
            onRestart={handleRestart}
            onReport={handleReport}
            isGeneratingReport={isGeneratingReport}
            interviewMode={interviewMode}
            practiceFeedback={practiceFeedback}
            practiceStep={practiceStep}
            onRetry={handleRetry}
            onNextQuestion={handleNextQuestion}
            practiceSubmitting={practiceSubmitting}
          />
        </div>
        {submitError && (
          <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 text-center">
            {submitError}
          </p>
        )}
        {reportError && (
          <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 text-center">
            {reportError}
          </p>
        )}
        {totalQuestions > 0 && !sessionComplete && (() => {
          const answered = messages.filter((m) => m.type === 'answer').length
          return (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>진행률</span>
                <span>{answered} / {totalQuestions} 답변 완료</span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-1.5 bg-[#4361ee] rounded-full transition-[width] duration-500"
                  style={{ width: `${(answered / totalQuestions) * 100}%` }}
                />
              </div>
            </div>
          )
        })()}
        <AnswerInput
          onSubmit={handleSubmit}
          disabled={submitting || practiceSubmitting}
          hidden={sessionComplete || (interviewMode === 'practice' && (practiceStep === 'feedback' || practiceStep === 'done'))}
        />
        <div ref={bottomRef} />
      </main>
    </div>
  )
}

export default function InterviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-4">
          <Spinner />
          <p className="text-sm text-gray-500">면접을 불러오는 중...</p>
        </div>
      }
    >
      <InterviewContent />
    </Suspense>
  )
}
