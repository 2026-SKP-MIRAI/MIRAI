'use client'

const MAX_LENGTH = 5000

type Props = {
  onSubmit: (answer: string) => void
  disabled?: boolean
  hidden?: boolean
}

export default function AnswerInput({ onSubmit, disabled = false, hidden = false }: Props) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const raw = fd.get('answer')
    const answer = (typeof raw === 'string' ? raw : '').trim()
    if (!answer) return
    onSubmit(answer)
    e.currentTarget.reset()
    const counter = e.currentTarget.querySelector('[data-char-counter]')
    if (counter) counter.textContent = `0 / ${MAX_LENGTH}`
  }

  if (hidden) return null

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        name="answer"
        maxLength={MAX_LENGTH}
        disabled={disabled}
        placeholder="답변을 입력하세요..."
        className="w-full rounded-xl border border-gray-300 p-4 text-sm focus:border-gray-500 focus:outline-none disabled:bg-gray-50"
        rows={4}
        onChange={(e) => {
          const counter = e.currentTarget.closest('form')?.querySelector('[data-char-counter]')
          if (counter) counter.textContent = `${e.currentTarget.value.length} / ${MAX_LENGTH}`
        }}
      />
      <div className="flex items-center justify-between">
        <span data-char-counter className="text-xs text-gray-400">
          0 / {MAX_LENGTH}
        </span>
        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {disabled ? '처리 중...' : '답변 제출'}
        </button>
      </div>
    </form>
  )
}
