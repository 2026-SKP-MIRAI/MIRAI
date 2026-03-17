'use client'

import type { QuestionWithPersona } from '@/lib/types'

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
}

export default function InterviewChat({
  messages,
  sessionComplete,
  onRestart,
  onReport,
  isGeneratingReport,
}: Props) {
  return (
    <div className="space-y-4">
      {messages.map((msg) => {
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
        return (
          <div key={msg.id} className="flex justify-end">
            <div className="max-w-[80%] rounded-xl bg-gray-800 px-4 py-3 text-white">
              <p>{msg.text}</p>
            </div>
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
