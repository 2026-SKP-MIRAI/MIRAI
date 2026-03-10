'use client'

import type { Category, Question } from '@/domain/interview/types'

interface Props {
  questions: Question[]
  onReset: () => void
}

const CATEGORY_ORDER: Category[] = ['직무 역량', '경험의 구체성', '성과 근거', '기술 역량']

export default function QuestionList({ questions, onReset }: Props) {
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
      <button
        onClick={onReset}
        className="mt-2 py-2 px-6 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors self-start"
      >
        다시 하기
      </button>
    </div>
  )
}
