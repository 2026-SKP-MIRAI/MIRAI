'use client'

import type { QuestionWithPersona, PracticeFeedbackResponse } from '@/lib/types'

const PERSONA_COLORS = {
  hr: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    label: 'text-blue-700',
  },
  tech_lead: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    label: 'text-green-700',
  },
  executive: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    label: 'text-purple-700',
  },
}

type Message =
  | { id: string; type: 'question'; data: QuestionWithPersona }
  | { id: string; type: 'answer'; text: string }

type Props = {
  messages: Message[]
  sessionComplete: boolean
  onRestart?: () => void
  onReport?: () => void
  isGeneratingReport?: boolean
  // practice 모드 전용 (모두 optional — 기본값 'real'로 하위 호환)
  interviewMode?: 'real' | 'practice'
  practiceFeedback?: PracticeFeedbackResponse | null
  practiceStep?: 'idle' | 'feedback' | 'retry' | 'done'
  onRetry?: () => void
  onNextQuestion?: () => void
  practiceSubmitting?: boolean
}

export default function InterviewChat({
  messages,
  sessionComplete,
  onRestart,
  onReport,
  isGeneratingReport,
  interviewMode = 'real',
  practiceFeedback,
  practiceStep = 'idle',
  onRetry,
  onNextQuestion,
  practiceSubmitting,
}: Props) {
  return (
    <div className="space-y-4">
      {messages.map((msg, index) => {
        if (msg.type === 'question') {
          const q = msg.data
          const colors = PERSONA_COLORS[q.persona] ?? PERSONA_COLORS.hr
          return (
            <div key={msg.id} className={`rounded-xl border p-4 ${colors.bg} ${colors.border}`}>
              <div className="mb-2 flex items-center gap-2">
                <span className={`text-sm font-semibold ${colors.label}`}>{q.personaLabel}</span>
                {q.type === 'follow_up' && (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                    꼬리질문
                  </span>
                )}
              </div>
              <p className="text-gray-900">{q.question}</p>
            </div>
          )
        }

        // answer 메시지
        const isLastMessage = index === messages.length - 1
        const showFeedback = interviewMode === 'practice' && isLastMessage && practiceFeedback && (practiceStep === 'feedback' || practiceStep === 'done')

        return (
          <div key={msg.id}>
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-xl bg-gray-800 px-4 py-3 text-white">
                <p>{msg.text}</p>
              </div>
            </div>

            {showFeedback && (
              <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
                {/* 점수 */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700">점수</span>
                  <span className="text-lg font-bold text-blue-600">{practiceFeedback.score}점</span>
                </div>

                {/* 잘한 점 */}
                {practiceFeedback.feedback.good.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-green-700">잘한 점</p>
                    <ul className="space-y-1">
                      {practiceFeedback.feedback.good.map((item, i) => (
                        <li key={i} className="text-sm text-gray-700">• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 개선할 점 */}
                {practiceFeedback.feedback.improve.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-orange-700">개선할 점</p>
                    <ul className="space-y-1">
                      {practiceFeedback.feedback.improve.map((item, i) => (
                        <li key={i} className="text-sm text-gray-700">• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 키워드 */}
                {practiceFeedback.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {practiceFeedback.keywords.map((kw, i) => (
                      <span key={i} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                        #{kw}
                      </span>
                    ))}
                  </div>
                )}

                {/* 개선 가이드 */}
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-semibold text-gray-600 mb-1">개선 가이드</p>
                  <p className="text-sm text-gray-700">{practiceFeedback.improvedAnswerGuide}</p>
                </div>

                {/* comparisonDelta (재답변 완료 후) */}
                {practiceStep === 'done' && practiceFeedback.comparisonDelta && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <p className="text-xs font-semibold text-green-700 mb-1">
                      향상도: {practiceFeedback.comparisonDelta.scoreDelta > 0 ? '+' : ''}{practiceFeedback.comparisonDelta.scoreDelta}점
                    </p>
                    <ul className="space-y-1">
                      {practiceFeedback.comparisonDelta.improvements.map((item, i) => (
                        <li key={i} className="text-sm text-green-800">• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 버튼 */}
                <div className="flex gap-2 pt-1">
                  {practiceStep === 'feedback' && onRetry && (
                    <button
                      onClick={onRetry}
                      disabled={practiceSubmitting}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      다시 답변하기
                    </button>
                  )}
                  {(practiceStep === 'feedback' || practiceStep === 'done') && onNextQuestion && (
                    <button
                      onClick={onNextQuestion}
                      disabled={practiceSubmitting}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      다음 질문
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {sessionComplete && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="mb-4 text-lg font-semibold text-gray-900">면접이 완료되었습니다.</p>
          <div className="flex justify-center gap-3">
            {onReport && (
              <button
                onClick={onReport}
                disabled={isGeneratingReport}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {isGeneratingReport ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 mr-2 inline"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    리포트 생성 중...
                  </>
                ) : (
                  '리포트 생성하기'
                )}
              </button>
            )}
            {onRestart && (
              <button
                onClick={onRestart}
                disabled={isGeneratingReport}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                다시 시작
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
