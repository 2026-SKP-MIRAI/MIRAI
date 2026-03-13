'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Category, Question } from '@/domain/interview/types'

interface Props {
  questions: Question[]
  resumeId: string
  onReset: () => void
}

const CATEGORY_ORDER: Category[] = ['직무 역량', '경험의 구체성', '성과 근거', '기술 역량']

export default function QuestionList({ questions, resumeId, onReset }: Props) {
  const router = useRouter()
  const [isStarting, setIsStarting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleInterviewStart() {
    setIsStarting(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? '면접 시작 중 오류가 발생했습니다.')
        return
      }
      router.push(`/interview?sessionId=${data.sessionId}`)
    } catch {
      setErrorMsg('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsStarting(false)
    }
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-gray-500">질문이 없습니다.</p>
        <button
          onClick={onReset}
          className="py-2 px-6 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          다시 하기
        </button>
      </div>
    )
  }

  const grouped = questions.reduce<Partial<Record<Category, Question[]>>>((acc, q) => {
    if (!acc[q.category]) acc[q.category] = []
    acc[q.category]!.push(q)
    return acc
  }, {})

  const categories = CATEGORY_ORDER.filter((c) => grouped[c])

  return (
    <div className="flex flex-col gap-6">
      {categories.map((category) => (
        <section key={category}>
          <h2 className="text-base font-bold text-blue-700 mb-2">{category}</h2>
          <ul className="flex flex-col gap-2">
            {grouped[category]!.map((q, i) => (
              <li key={i} className="p-3 bg-gray-50 rounded text-sm text-gray-800">
                {q.question}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {errorMsg && (
        <p className="text-sm text-red-600" role="alert">{errorMsg}</p>
      )}

      <div className="flex gap-3 mt-2">
        <button
          onClick={handleInterviewStart}
          disabled={isStarting}
          className="py-2 px-6 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isStarting ? '면접 준비 중...' : '면접 시작'}
        </button>
        <button
          onClick={onReset}
          className="py-2 px-6 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          다시 하기
        </button>
      </div>
    </div>
  )
}
