'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { QuestionWithPersona, HistoryItem, PersonaType, PracticeFeedback, PracticeStepState } from '@/domain/interview/types'

interface Props {
  sessionId: string
  initialQuestion: QuestionWithPersona
  initialHistory?: HistoryItem[]
  initialComplete?: boolean
  interviewMode?: 'real' | 'practice'
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
  interviewMode = 'real',
  onComplete,
}: Props) {
  const router = useRouter()
  const [currentQuestion, setCurrentQuestion] = useState<QuestionWithPersona>(initialQuestion)
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory)
  const [answerInput, setAnswerInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionComplete, setSessionComplete] = useState(initialComplete)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  // 연습 모드 상태
  const [practicePhase, setPracticePhase] = useState<PracticeStepState>('idle')
  const [practiceFeedback, setPracticeFeedback] = useState<PracticeFeedback | null>(null)
  const [previousAnswer, setPreviousAnswer] = useState<string | undefined>(undefined)
  const [lastAnswer, setLastAnswer] = useState<string>('')
  const [pendingNextQuestion, setPendingNextQuestion] = useState<QuestionWithPersona | null>(null)
  const [pendingComplete, setPendingComplete] = useState(false)

  async function handleGenerateReport() {
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
        setReportError(data.error ?? '리포트 생성 중 오류가 발생했습니다.')
        return
      }
      router.push(`/report?reportId=${data.reportId}`)
    } catch {
      setReportError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsGeneratingReport(false)
    }
  }

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

      setLastAnswer(answer)

      if (interviewMode === 'practice' && !data.sessionComplete) {
        // 연습 모드: 다음 질문 보류, practice/feedback 호출
        setPendingNextQuestion(data.nextQuestion ?? null)
        setPendingComplete(!!data.sessionComplete)
        setLastAnswer(answer)

        const feedbackRes = await fetch('/api/practice/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: currentQuestion.question,
            answer,
            ...(previousAnswer ? { previousAnswer } : {}),
          }),
        })
        const feedbackData = await feedbackRes.json()
        if (feedbackRes.ok) {
          setPracticeFeedback(feedbackData)
          // previousAnswer가 설정돼 있으면 재답변 → retry-feedback, 아니면 first-feedback
          setPracticePhase(previousAnswer !== undefined ? 'retry-feedback' : 'first-feedback')
        } else {
          // 피드백 실패 시 그냥 다음 질문으로 진행
          advanceToNext(data, answer)
        }
        setAnswerInput('')
      } else {
        // 실전 모드 또는 면접 완료
        advanceToNext(data, answer)
        setAnswerInput('')
      }
    } catch {
      setErrorMsg('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  function advanceToNext(data: { nextQuestion?: QuestionWithPersona | null; sessionComplete?: boolean }, answer: string) {
    const newHistoryItem: HistoryItem = {
      persona: currentQuestion.persona,
      personaLabel: currentQuestion.personaLabel,
      question: currentQuestion.question,
      answer,
      questionType: currentQuestion.type,
    }
    setHistory((prev) => [...prev, newHistoryItem])

    if (data.sessionComplete) {
      setSessionComplete(true)
    } else if (data.nextQuestion) {
      setCurrentQuestion(data.nextQuestion)
    }
  }

  function handleRetry() {
    setPreviousAnswer(lastAnswer)
    setPracticePhase('idle')
    setPracticeFeedback(null)
  }

  function handleNextQuestion() {
    const newHistoryItem: HistoryItem = {
      persona: currentQuestion.persona,
      personaLabel: currentQuestion.personaLabel,
      question: currentQuestion.question,
      answer: lastAnswer,
      questionType: currentQuestion.type,
    }
    setHistory((prev) => [...prev, newHistoryItem])
    setPracticeFeedback(null)
    setPreviousAnswer(undefined)
    setPracticePhase('idle')

    if (pendingComplete) {
      setSessionComplete(true)
    } else if (pendingNextQuestion) {
      setCurrentQuestion(pendingNextQuestion)
      setPendingNextQuestion(null)
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
        {reportError && (
          <p className="text-sm text-red-600" role="alert">{reportError}</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={handleGenerateReport}
            disabled={isGeneratingReport}
            className="py-2 px-6 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGeneratingReport ? '생성 중...' : '리포트 생성'}
          </button>
          <button
            onClick={onComplete}
            className="mt-2 py-2 px-6 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            처음으로
          </button>
        </div>
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

      {/* 연습 모드 피드백 패널 */}
      {practiceFeedback && (practicePhase === 'first-feedback' || practicePhase === 'retry-feedback') && (
        <div className="p-4 border border-indigo-200 bg-indigo-50 rounded-lg flex flex-col gap-3" data-testid="practice-feedback">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-indigo-800">즉각 피드백</h3>
            <span className="text-lg font-bold text-indigo-700">{practiceFeedback.score}점</span>
          </div>
          {practiceFeedback.comparisonDelta != null && (
            <p className="text-xs text-indigo-600">
              이전 답변 대비 {practiceFeedback.comparisonDelta.scoreDelta > 0 ? '+' : ''}{practiceFeedback.comparisonDelta.scoreDelta}점
            </p>
          )}
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold text-green-700">잘한 점</p>
            <ul className="flex flex-col gap-0.5">
              {practiceFeedback.feedback.good.map((item, i) => (
                <li key={i} className="text-sm text-gray-700">• {item}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold text-amber-700">개선할 점</p>
            <ul className="flex flex-col gap-0.5">
              {practiceFeedback.feedback.improve.map((item, i) => (
                <li key={i} className="text-sm text-gray-700">• {item}</li>
              ))}
            </ul>
          </div>
          {practiceFeedback.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {practiceFeedback.keywords.map((kw, i) => (
                <span key={i} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">{kw}</span>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-500 italic">{practiceFeedback.improvedAnswerGuide}</p>
          <div className="flex gap-2 pt-1">
            {practicePhase === 'first-feedback' && (
              <button
                onClick={handleRetry}
                className="py-1.5 px-4 border border-indigo-400 text-indigo-700 text-sm rounded-lg hover:bg-indigo-100 transition-colors"
              >
                다시 답변하기
              </button>
            )}
            <button
              onClick={handleNextQuestion}
              className="py-1.5 px-4 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
            >
              다음 질문
            </button>
          </div>
        </div>
      )}

      {practicePhase === 'idle' && (
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
      )}
    </div>
  )
}
