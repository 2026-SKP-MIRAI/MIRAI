import type { FeedbackTrendComparison } from '@/lib/types'

interface Props {
  trendComparison: FeedbackTrendComparison | null
}

export function FeedbackTrendCard({ trendComparison }: Props) {
  if (!trendComparison) return null

  const { trendingSkills, similarPostings } = trendComparison

  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-4">
      <h3 className="font-semibold text-gray-800">트렌딩 기술 스택</h3>
      <div className="flex flex-wrap gap-2">
        {trendingSkills.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
          >
            {skill}
          </span>
        ))}
      </div>

      {similarPostings.length > 0 && (
        <>
          <h3 className="font-semibold text-gray-800">유사 채용공고</h3>
          <ul className="space-y-2">
            {similarPostings.map((posting, idx) => (
              <li key={idx} className="flex items-start justify-between text-sm">
                <div>
                  <a
                    href={posting.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {posting.title}
                  </a>
                  <span className="text-gray-500 ml-1">— {posting.company}</span>
                </div>
                <span className="text-gray-400 ml-2 shrink-0">
                  {(posting.similarity * 100).toFixed(0)}% 유사
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
