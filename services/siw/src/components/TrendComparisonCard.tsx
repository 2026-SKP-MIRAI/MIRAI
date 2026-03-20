"use client"
import type { TrendComparison } from "@/lib/types"

type Props = {
  trendComparison: TrendComparison
}

export default function TrendComparisonCard({ trendComparison }: Props) {
  const { role, trendSkills, coverageScore } = trendComparison

  const coverageColor =
    coverageScore >= 70
      ? "linear-gradient(90deg,#10B981,#34D399)"
      : coverageScore >= 40
      ? "linear-gradient(90deg,#7C3AED,#9B59E8)"
      : "linear-gradient(90deg,#F59E0B,#D97706)"

  return (
    <div className="bg-white/90 backdrop-blur-sm border border-black/[0.08] rounded-2xl p-6 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] transition-all duration-200">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-900">트렌드 스킬 비교</h2>
        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-blue-100 text-blue-700">
          {role}
        </span>
      </div>

      {/* 커버리지 점수 바 */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-600 font-medium">트렌드 스킬 커버리지</span>
          <span className="text-xs font-bold text-gray-900">{coverageScore}점</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${coverageScore}%`, background: coverageColor }}
          />
        </div>
      </div>

      {/* 스킬 목록 */}
      {trendSkills.length > 0 ? (
        <div className="space-y-2">
          {trendSkills.map((item) => (
            <div key={item.skill} className="flex items-center gap-3">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  item.inResume ? "bg-emerald-400" : "bg-gray-300"
                }`}
              />
              <span
                className={`text-sm flex-1 ${
                  item.inResume ? "text-gray-900 font-medium" : "text-gray-400"
                }`}
              >
                {item.skill}
              </span>
              <span className="text-[11px] text-gray-400 shrink-0">
                {Math.round(item.weight * 100)}%
              </span>
              {item.inResume ? (
                <span className="text-[11px] font-semibold text-emerald-600 shrink-0">보유</span>
              ) : (
                <span className="text-[11px] font-semibold text-gray-400 shrink-0">미보유</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl p-5 text-center border border-black/[0.05]">
          <p className="text-sm text-gray-400">트렌드 스킬 데이터를 불러오는 중입니다.</p>
        </div>
      )}
    </div>
  )
}
