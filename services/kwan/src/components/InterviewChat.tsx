'use client'

import { useState } from 'react'
import type { QuestionWithPersona, HistoryItem, PersonaType } from '@/domain/interview/types'

interface Props {
  sessionId: string
  initialQuestion: QuestionWithPersona
  initialHistory?: HistoryItem[]
  initialComplete?: boolean
  onComplete: () => void
}

const PERSONA_COLORS: Record<PersonaType, { bg: string; text: string; label: string }> = {
  hr: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'HR 담당자' },
  tech_lead: { bg: 'bg-green-100', text: 'text-green-800', label: '기술팀장' },
  executive: { bg: 'bg-purple-100', text: 'text-purple-800', label: '경영진' },
}

export default function InterviewChat({
  sessionId,
  initialQuestion,
  initialHistory = [],
  initialComplete = false,
  onComplete,
}: Props) {
  const [currentQuestion, setCurrentQuestion] = useState<QuestionWithPersona>(initialQuestion)
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory)
  const [answerInput, setAnswerInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionComplete, setSessionComplete] = useState(initialComplete)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!answerInput.trim() || isLoading) return

    const answer = answerInput.trim()
    setIsLoading(true)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/interview/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, answer }),
      })

      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? '오류가 발생했습니다.')
        return
      }

      const newHistoryItem: HistoryItem = {
        persona: currentQuestion.persona,
        personaLabel: currentQuestion.personaLabel,
        question: currentQuestion.question,
        answer,
        questionType: currentQuestion.type,
      }
      setHistory((prev) => [...prev, newHistoryItem])
      setAnswerInput('')

      if (data.sessionComplete) {
        setSessionComplete(true)
      } else if (data.nextQuestion) {
        setCurrentQuestion(data.nextQuestion)
      }
    } catch {
      setErrorMsg('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  if (sessionComplete) {
    return (
      <div className="flex flex-col gap-6">
        <div className="p-6 bg-green-50 rounded-lg text-center">
          <h2 className="text-xl font-bold text-green-800 mb-2">면접이 완료되었습니다!</h2>
          <p className="text-sm text-green-600">총 {history.length}개의 질문에 답변하셨습니다.</p>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-bold text-gray-700">면접 요약</h3>
          {history.map((item, i) => {
            const colors = PERSONA_COLORS[item.persona] ?? PERSONA_COLORS.hr
            return (
              <div key={i} className="flex flex-col gap-1">
                <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${colors.bg}`}>
                  <span className={`text-xs font-semibold ${colors.text}`}>{item.personaLabel}</span>
                  {item.questionType === 'follow_up' && (
                    <span className={`text-xs ${colors.text} opacity-60`}>(꼬리질문)</span>
                  )}
                  <p className={`text-sm ${colors.text}`}>{item.question}</p>
                </div>
                <p className="text-sm text-gray-700 px-3 py-2 bg-gray-50 rounded-lg ml-4">
                  {item.answer}
                </p>
              </div>
            )
          })}
        </div>
        <button
          onClick={onComplete}
          className="mt-2 py-2 px-6 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors self-start"
        >
          처음으로
        </button>
      </div>
    )
  }

  const colors = PERSONA_COLORS[currentQuestion.persona] ?? PERSONA_COLORS.hr

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {history.map((item, i) => {
          const hColors = PERSONA_COLORS[item.persona] ?? PERSONA_COLORS.hr
          return (
            <div key={i} className="flex flex-col gap-1">
              <div className={`px-3 py-2 rounded-lg ${hColors.bg}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${hColors.text}`}>{item.personaLabel}</span>
                  {item.questionType === 'follow_up' && (
                    <span className={`text-xs ${hColors.text} opacity-60`}>(꼬리질문)</span>
                  )}
                </div>
                <p className={`text-sm ${hColors.text} mt-1`}>{item.question}</p>
              </div>
              <p className="text-sm text-gray-700 px-3 py-2 bg-gray-50 rounded-lg ml-4">
                {item.answer}
              </p>
            </div>
          )
        })}

        <div className={`px-3 py-2 rounded-lg ${colors.bg}`} data-testid="current-question">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${colors.text}`}>{currentQuestion.personaLabel}</span>
            {currentQuestion.type === 'follow_up' && (
              <span className={`text-xs ${colors.text} opacity-60`}>(꼬리질문)</span>
            )}
          </div>
          <p className={`text-sm ${colors.text} mt-1`}>{currentQuestion.question}</p>
        </div>
      </div>

      {errorMsg && (
        <p className="text-sm text-red-600" role="alert">{errorMsg}</p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={answerInput}
          onChange={(e) => setAnswerInput(e.target.value)}
          placeholder="답변을 입력하세요..."
          rows={4}
          className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          disabled={isLoading}
          aria-label="답변 입력"
        />
        <button
          type="submit"
          disabled={isLoading || !answerInput.trim()}
          className="py-2 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
        >
          {isLoading ? '처리 중...' : '답변 제출'}
        </button>
      </form>
    </div>
  )
}
