'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import InterviewChat from '@/components/InterviewChat'
import AnswerInput from '@/components/AnswerInput'
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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">면접을 불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">MirAI — 패널 면접</h1>
        <button
          onClick={() => router.push('/dashboard')}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          나가기
        </button>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-8 space-y-6">
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
          totalQuestions={totalQuestions}
        />
        {submitError && (
          <p role="alert" className="text-sm text-red-600 text-center px-4">
            {submitError}
          </p>
        )}
        {reportError && (
          <p role="alert" className="text-sm text-red-600 text-center px-4">
            {reportError}
          </p>
        )}
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
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-gray-500">면접을 불러오는 중...</p>
        </div>
      }
    >
      <InterviewContent />
    </Suspense>
  )
}
