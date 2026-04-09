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
  totalQuestions?: number
  onComplete: () => void
}

const PERSONA_STYLES: Record<PersonaType, { pillBg: string; pillText: string; label: string }> = {
  hr:        { pillBg: '#142447', pillText: '#3b82f6', label: 'HR 담당자' },
  tech_lead: { pillBg: '#142e1e', pillText: '#34d399', label: '기술팀장' },
  executive: { pillBg: '#2c2010', pillText: '#f59e0b', label: '경영진' },
}

export default function InterviewChat({
  sessionId,
  initialQuestion,
  initialHistory = [],
  initialComplete = false,
  interviewMode = 'real',
  totalQuestions,
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

  const currentIdx = history.length + 1
  const total = totalQuestions ?? 9
  const progress = Math.min((history.length / total) * 100, 100)
  const persona = PERSONA_STYLES[currentQuestion.persona] ?? PERSONA_STYLES.hr
  const lastHistoryItem = history[history.length - 1] ?? null

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
        setPendingNextQuestion(data.nextQuestion ?? null)
        setPendingComplete(!!data.sessionComplete)

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
          setPracticePhase(previousAnswer !== undefined ? 'retry-feedback' : 'first-feedback')
        } else {
          advanceToNext(data, answer)
        }
        setAnswerInput('')
      } else {
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

  /* ── 면접 완료 화면 ── */
  if (sessionComplete) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* 완료 카드 */}
        <div
          className="matte-card"
          style={{ padding: '2rem', textAlign: 'center', borderColor: 'rgba(45,212,191,0.3)', background: 'var(--kwan-teal-dim)' }}
        >
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--kwan-teal)', marginBottom: '0.5rem' }}>면접 완료</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--kwan-text-2)' }}>총 {history.length}개의 질문에 답변하셨습니다.</p>
        </div>

        {/* 요약 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {history.map((item, i) => {
            const s = PERSONA_STYLES[item.persona] ?? PERSONA_STYLES.hr
            return (
              <div key={i} className="matte-card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem', fontWeight: 600, padding: '0.125rem 0.5rem',
                      borderRadius: '999px', background: s.pillBg, color: s.pillText,
                    }}
                  >
                    {item.personaLabel}
                  </span>
                  {item.questionType === 'follow_up' && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--kwan-teal)' }}>꼬리질문</span>
                  )}
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--kwan-text)', marginBottom: '0.5rem', fontWeight: 600 }}>{item.question}</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--kwan-text-2)', lineHeight: 1.6 }}>{item.answer}</p>
              </div>
            )
          })}
        </div>

        {reportError && (
          <p style={{ fontSize: '0.875rem', color: 'var(--kwan-error)' }} role="alert">{reportError}</p>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={handleGenerateReport}
            disabled={isGeneratingReport}
            className="btn-primary"
            style={{ padding: '0.875rem 2rem', fontSize: '0.9375rem', flex: 1 }}
          >
            {isGeneratingReport ? '생성 중...' : '리포트 생성 →'}
          </button>
          <button
            onClick={onComplete}
            className="btn-outline"
            style={{ padding: '0.875rem 1.5rem', fontSize: '0.9375rem' }}
          >
            처음으로
          </button>
        </div>
      </div>
    )
  }

  /* ── 면접 진행 화면 ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* 진행 상태 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--kwan-text-2)' }}>
          면접 진행 중&nbsp;&nbsp;·&nbsp;&nbsp;
          <span style={{ color: 'var(--kwan-teal)' }}>{currentIdx}</span>
          <span style={{ color: 'var(--kwan-text-muted)' }}> / {total} 질문</span>
        </span>
        <button
          onClick={onComplete}
          style={{
            fontSize: '0.8125rem', fontWeight: 500, color: 'var(--kwan-error)',
            background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: '0.5rem', padding: '0.25rem 0.875rem', cursor: 'pointer',
          }}
        >
          나가기
        </button>
      </div>

      {/* 진행률 바 */}
      <div style={{ height: 6, borderRadius: 3, background: 'var(--kwan-elevated)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%', borderRadius: 3,
            background: 'var(--kwan-teal)',
            width: `${progress}%`,
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* 질문 카드 */}
      <div className="matte-card" style={{ padding: '1.5rem' }} data-testid="current-question">
        {/* 페르소나 pill */}
        <span
          style={{
            display: 'inline-block', fontSize: '0.75rem', fontWeight: 600,
            padding: '0.25rem 0.75rem', borderRadius: '999px',
            background: persona.pillBg, color: persona.pillText,
            marginBottom: '0.875rem',
          }}
        >
          {currentQuestion.personaLabel}
        </span>

        {/* 질문 텍스트 */}
        <p style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--kwan-text)', lineHeight: 1.5, marginBottom: '0.75rem' }}>
          {currentQuestion.question}
        </p>

        {/* 서브텍스트 */}
        <p style={{ fontSize: '0.75rem', color: 'var(--kwan-text-muted)' }}>
          질문 {currentIdx}/{total}
          {lastHistoryItem && `  ·  이전 질문: ${lastHistoryItem.question.slice(0, 30)}${lastHistoryItem.question.length > 30 ? '...' : ''}`}
        </p>
      </div>

      {/* 꼬리질문 표시 */}
      {currentQuestion.type === 'follow_up' && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'var(--kwan-teal-dim)',
            borderRadius: 'var(--kwan-radius)',
            fontSize: '0.8125rem', fontWeight: 600, color: 'var(--kwan-teal)',
          }}
        >
          💬 꼬리질문 — 이전 답변을 바탕으로 한 추가 질문입니다
        </div>
      )}

      {errorMsg && (
        <p style={{ fontSize: '0.875rem', color: 'var(--kwan-error)' }} role="alert">{errorMsg}</p>
      )}

      {/* 연습 모드 피드백 */}
      {practiceFeedback && (practicePhase === 'first-feedback' || practicePhase === 'retry-feedback') && (
        <div
          className="matte-card"
          style={{ padding: '1.25rem', borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.06)' }}
          data-testid="practice-feedback"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--kwan-amber)' }}>📝 연습 모드 피드백</span>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--kwan-amber)' }}>{practiceFeedback.score}점</span>
          </div>

          {practiceFeedback.comparisonDelta != null && (
            <p style={{ fontSize: '0.75rem', color: 'var(--kwan-text-2)', marginBottom: '0.5rem' }}>
              이전 답변 대비 {practiceFeedback.comparisonDelta.scoreDelta > 0 ? '+' : ''}{practiceFeedback.comparisonDelta.scoreDelta}점
            </p>
          )}

          <div style={{ marginBottom: '0.5rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#34d399', marginBottom: '0.25rem' }}>잘한 점</p>
            {practiceFeedback.feedback.good.map((item, i) => (
              <p key={i} style={{ fontSize: '0.8125rem', color: 'var(--kwan-text-2)' }}>• {item}</p>
            ))}
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--kwan-amber)', marginBottom: '0.25rem' }}>개선할 점</p>
            {practiceFeedback.feedback.improve.map((item, i) => (
              <p key={i} style={{ fontSize: '0.8125rem', color: 'var(--kwan-text-2)' }}>• {item}</p>
            ))}
          </div>

          {practiceFeedback.keywords.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.75rem' }}>
              {practiceFeedback.keywords.map((kw, i) => (
                <span key={i} className="tag tag-amber">{kw}</span>
              ))}
            </div>
          )}

          <p style={{ fontSize: '0.75rem', color: 'var(--kwan-text-muted)', fontStyle: 'italic', marginBottom: '0.875rem' }}>
            {practiceFeedback.improvedAnswerGuide}
          </p>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {practicePhase === 'first-feedback' && (
              <button onClick={handleRetry} className="btn-outline" style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}>
                다시 답변하기
              </button>
            )}
            <button onClick={handleNextQuestion} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}>
              다음 질문 →
            </button>
          </div>
        </div>
      )}

      {/* 답변 입력 */}
      {practicePhase === 'idle' && (
        <form onSubmit={handleSubmit}>
          <div className="matte-card" style={{ padding: '1rem' }}>
            <textarea
              value={answerInput}
              onChange={(e) => setAnswerInput(e.target.value)}
              placeholder="답변을 입력하세요..."
              rows={5}
              disabled={isLoading}
              aria-label="답변 입력"
              style={{
                width: '100%', background: 'transparent', border: 'none', outline: 'none',
                fontSize: '0.9375rem', color: 'var(--kwan-text)', resize: 'none',
                lineHeight: 1.7, fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <button
                type="submit"
                disabled={isLoading || !answerInput.trim()}
                className="btn-primary"
                style={{ padding: '0.75rem 1.75rem', fontSize: '0.9375rem' }}
              >
                {isLoading ? '처리 중...' : '답변 제출 →'}
              </button>
            </div>
          </div>
        </form>
      )}

      <p style={{ fontSize: '0.6875rem', color: 'var(--kwan-text-muted)', textAlign: 'center' }}>
        {interviewMode === 'practice' ? '연습 모드 — 답변마다 즉각 피드백 제공' : '실전 모드 — 모든 질문 완료 후 리포트 생성'}
      </p>
    </div>
  )
}
