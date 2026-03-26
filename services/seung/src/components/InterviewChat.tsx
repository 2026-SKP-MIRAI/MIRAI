'use client'

import type { QuestionWithPersona, PracticeFeedbackResponse, InterviewMode } from '@/lib/types'

const PERSONA_LABELS: Record<string, string> = {
  hr: 'HR 담당자',
  tech_lead: '기술 리드',
  executive: '임원',
}

// 모든 페르소나 통일: 옅은 보라 계열 배경 + 테두리
const PERSONA_STYLE: Record<string, { bg: string; border: string; nameColor: string }> = {
  hr:        { bg: 'bg-white', border: 'border-purple-200', nameColor: 'font-bold text-[#7C3AED]' },
  tech_lead: { bg: 'bg-white', border: 'border-purple-200', nameColor: 'font-bold text-[#7C3AED]' },
  executive: { bg: 'bg-white', border: 'border-purple-200', nameColor: 'font-bold text-[#7C3AED]' },
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
  // streaming
  streamingText?: string
  streamingPersona?: { persona: string; personaLabel: string } | null
  // practice 모드 전용 (모두 optional — 기본값 'real'로 하위 호환)
  interviewMode?: InterviewMode
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
  streamingText,
  streamingPersona,
  interviewMode = 'real',
  practiceFeedback,
  practiceStep = 'idle',
  onRetry,
  onNextQuestion,
  practiceSubmitting,
}: Props) {
  const answerCount = messages.filter((m) => m.type === 'answer').length

  return (
    <div className="space-y-4">
      {messages.map((msg, index) => {
        if (msg.type === 'question') {
          const q = msg.data
          const style = PERSONA_STYLE[q.persona] ?? PERSONA_STYLE.hr
          return (
            <div key={msg.id} data-testid="chat-message" className={`rounded-2xl border p-4 ${style.bg} ${style.border}`}>
              <div className="mb-2 flex items-center gap-2">
                <span data-testid="persona-label" className={`rounded-full px-2 py-0.5 text-sm ${style.nameColor}`}>
                  {q.personaLabel}
                </span>
                {q.type === 'follow_up' && (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                    꼬리질문
                  </span>
                )}
              </div>
              <p className="text-sm text-[#1F2937] leading-relaxed">{q.question}</p>
            </div>
          )
        }

        // answer 메시지
        const isLastMessage = index === messages.length - 1
        const showFeedback =
          interviewMode === 'practice' &&
          isLastMessage &&
          practiceFeedback &&
          (practiceStep === 'feedback' || practiceStep === 'done')

        return (
          <div key={msg.id}>
            <div className="flex justify-end">
              <div data-testid="user-answer" className="max-w-[80%] rounded-2xl bg-[#1a1a2e] px-4 py-3 text-white">
                <p className="text-sm leading-relaxed">{msg.text}</p>
              </div>
            </div>

            {showFeedback && practiceFeedback && (
              <div className="mt-3 rounded-2xl border border-violet-200 bg-white p-5 shadow-sm space-y-4">
                {/* 점수 */}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-violet-700">AI 피드백</p>
                  <span className="text-lg font-extrabold text-violet-700">{practiceFeedback.score}점</span>
                </div>

                {/* 점수 바 */}
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-violet-500 to-indigo-500 h-2 rounded-full transition-all"
                    style={{ width: `${practiceFeedback.score}%` }}
                  />
                </div>

                {/* 잘한 점 */}
                {practiceFeedback.feedback.good.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[#10B981] mb-1">잘한 점</p>
                    <ul className="space-y-1">
                      {practiceFeedback.feedback.good.map((item, i) => (
                        <li key={i} className="text-xs text-[#374151] leading-relaxed">• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 개선할 점 */}
                {practiceFeedback.feedback.improve.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[#F59E0B] mb-1">개선할 점</p>
                    <ul className="space-y-1">
                      {practiceFeedback.feedback.improve.map((item, i) => (
                        <li key={i} className="text-xs text-[#374151] leading-relaxed">• {item}</li>
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
                  <p className="text-xs text-[#374151] leading-relaxed">{practiceFeedback.improvedAnswerGuide}</p>
                </div>

                {/* 향상도 (재답변 완료 후) */}
                {practiceStep === 'done' && practiceFeedback.comparisonDelta && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <p className="text-xs font-bold text-green-700 mb-1">
                      향상도: {practiceFeedback.comparisonDelta.scoreDelta > 0 ? '+' : ''}{practiceFeedback.comparisonDelta.scoreDelta}점
                    </p>
                    <ul className="space-y-1">
                      {practiceFeedback.comparisonDelta.improvements.map((item, i) => (
                        <li key={i} className="text-xs text-green-800">• {item}</li>
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

      {/* 다음 질문 스트리밍 버블 */}
      {!sessionComplete && streamingText && (() => {
        const persona = streamingPersona?.persona ?? 'hr'
        const style = PERSONA_STYLE[persona] ?? PERSONA_STYLE.hr
        const label = streamingPersona?.personaLabel ?? (PERSONA_LABELS[persona] ?? persona)
        return (
          <div data-testid="streaming-text" className={`rounded-2xl border p-4 ${style.bg} ${style.border}`}>
            <p className={`${style.nameColor} mb-2 text-sm`}>{label}</p>
            <p className="text-sm text-[#1F2937] leading-relaxed">
              {streamingText}
              <span className="inline-block w-0.5 h-3.5 bg-purple-500 ml-0.5 animate-pulse" />
            </p>
          </div>
        )
      })()}

      {!sessionComplete && answerCount < 5 && interviewMode !== 'practice' && (
        <p className="text-xs text-gray-400 text-center">
          리포트는 5개 이상 답변 후 생성할 수 있습니다
        </p>
      )}

      {!sessionComplete && answerCount >= 5 && onReport && (
        <div className="flex justify-end">
          <button
            onClick={onReport}
            disabled={isGeneratingReport}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {isGeneratingReport ? '리포트 생성 중...' : '리포트 생성하기'}
          </button>
        </div>
      )}

      {sessionComplete && (
        <div data-testid="session-complete" className="rounded-2xl border border-gray-200 bg-white px-8 py-10 text-center shadow-sm">
          <p className="mb-6 text-lg font-semibold text-gray-900">면접이 완료되었습니다.</p>
          <div className="flex justify-center gap-3">
            {onReport && (
              <button
                onClick={onReport}
                disabled={isGeneratingReport}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {isGeneratingReport ? '리포트 생성 중...' : '리포트 생성하기'}
              </button>
            )}
            {onRestart && (
              <button
                onClick={onRestart}
                disabled={isGeneratingReport}
                className="rounded-lg bg-[#1a1a2e] px-4 py-2 text-sm font-medium text-white hover:bg-[#16213e] disabled:opacity-50"
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
