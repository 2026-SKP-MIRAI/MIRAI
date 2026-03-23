'use client'

import { useState, useEffect, useRef } from 'react'

const MAX_LENGTH = 5000

type Props = {
  onSubmit: (answer: string) => void
  disabled?: boolean
  hidden?: boolean
}

export default function AnswerInput({ onSubmit, disabled = false, hidden = false }: Props) {
  const [value, setValue] = useState('')
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (valueRef.current.trim()) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const answer = value.trim()
    if (!answer) return
    onSubmit(answer)
    setValue('')
  }

  if (hidden) return null

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        name="answer"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={MAX_LENGTH}
        disabled={disabled}
        placeholder="답변을 입력하세요..."
        className="w-full rounded-xl border border-gray-200 p-4 text-sm focus:border-[#4361ee] focus:outline-none focus:ring-2 focus:ring-[#4361ee]/20 disabled:bg-gray-50"
        rows={4}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {value.length} / {MAX_LENGTH}
        </span>
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="rounded-lg bg-[#1a1a2e] px-4 py-2 text-sm font-medium text-white hover:bg-[#16213e] disabled:opacity-50"
        >
          {disabled ? '처리 중...' : '답변 제출'}
        </button>
      </div>
    </form>
  )
}
