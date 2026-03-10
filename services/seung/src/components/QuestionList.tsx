'use client'

import type { Question } from '@/lib/types'

/** MVP 명세(docs/specs/mvp/dev_spec.md) 기준 카테고리 고정 순서 */
const CATEGORIES_ORDER = [
  '직무 역량',
  '경험의 구체성',
  '성과 근거',
  '기술 역량',
] as const

type Props = {
  questions: Question[]
  onReset: () => void
}

function groupByCategory(questions: Question[]): Record<string, Question[]> {
  return questions.reduce<Record<string, Question[]>>((acc, q) => {
    if (!acc[q.category]) acc[q.category] = []
    acc[q.category].push(q)
    return acc
  }, {})
}

export default function QuestionList({ questions, onReset }: Props) {
  const grouped = groupByCategory(questions)
  const knownCategories = CATEGORIES_ORDER.filter((c) => grouped[c])
  const otherCategories = Object.keys(grouped).filter(
    (c) => !(CATEGORIES_ORDER as readonly string[]).includes(c)
  )
  const orderedCategories = [...knownCategories, ...otherCategories]

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">
          예상 면접 질문 ({questions.length}개)
        </h2>
        <button
          onClick={onReset}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          다시 하기
        </button>
      </div>

      <div className="flex flex-col gap-6">
        {orderedCategories.map((category) => {
          const items = grouped[category]
          if (!items?.length) return null
          return (
            <section key={category}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-600">
                {category}
              </h3>
              <ul className="flex flex-col gap-3">
                {items.map((q, idx) => (
                  <li
                    key={idx}
                    className="rounded-lg border border-gray-200 bg-white px-5 py-4 text-sm text-gray-800 shadow-sm"
                  >
                    {q.question}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
