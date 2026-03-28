"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { MessageSquare, TrendingUp, FileText, BarChart2, Flame } from "lucide-react"
import type { GrowthSession } from "@/lib/types"
import { createSupabaseBrowser } from "@/lib/supabase/browser"

function toKSTDateString(isoString: string): string {
  return new Date(isoString).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

function calcStreak(sessions: GrowthSession[]): number {
  if (sessions.length === 0) return 0
  const kstDates = [...new Set(sessions.map(s => toKSTDateString(s.createdAt)))].sort().reverse()
  const todayKST = toKSTDateString(new Date().toISOString())
  const yesterdayKST = toKSTDateString(new Date(Date.now() - 86400000).toISOString())
  // 오늘 또는 어제부터 시작하지 않으면 0
  if (kstDates[0] !== todayKST && kstDates[0] !== yesterdayKST) return 0
  let streak = 0
  let prev = new Date(kstDates[0].replace(/(\d+)\. (\d+)\. (\d+)\./, "$1-$2-$3"))
  for (const d of kstDates) {
    const cur = new Date(d.replace(/(\d+)\. (\d+)\. (\d+)\./, "$1-$2-$3"))
    const diff = Math.round((prev.getTime() - cur.getTime()) / 86400000)
    if (diff > 1) break
    streak++
    prev = cur
  }
  return streak
}

function calcHeatmap(sessions: GrowthSession[]): Record<string, number> {
  const map: Record<string, number> = {}
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    map[toKSTDateString(d.toISOString())] = 0
  }
  for (const s of sessions) {
    const k = toKSTDateString(s.createdAt)
    if (k in map) map[k] = (map[k] ?? 0) + 1
  }
  return map
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.065 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const } },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })
}

function getScoreCircleClass(score: number) {
  if (score >= 80) return { bg: "#D1FAE5", color: "#065F46" }
  if (score >= 70) return { bg: "#DBEAFE", color: "#1E40AF" }
  return { bg: "#EDE9FE", color: "#5B21B6" }
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<GrowthSession[]>([])
  const [resumeCount, setResumeCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const supabase = createSupabaseBrowser()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserName(user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? null)
      setIsAdmin((user?.app_metadata as { role?: string })?.role === "admin")
    })
  }, [])

  useEffect(() => {
    Promise.all([
      fetch("/api/growth/sessions").then(r => r.json()).catch(() => []),
      fetch("/api/resumes").then(r => r.json()).catch(() => []),
    ]).then(([sess, resumes]) => {
      setSessions(Array.isArray(sess) ? sess : [])
      setResumeCount(Array.isArray(resumes) ? resumes.length : 0)
      setLoading(false)
    })
  }, [])

  const avgScore = sessions.length > 0
    ? Math.round(sessions.reduce((s, x) => s + x.reportTotalScore, 0) / sessions.length)
    : null

  const growthRate = sessions.length >= 2
    ? sessions[0].reportTotalScore - sessions[1].reportTotalScore
    : null

  const streak = calcStreak(sessions)
  const heatmap = calcHeatmap(sessions)

  const latestSession = sessions[0]
  const axisKeys = latestSession ? Object.entries(latestSession.scores) : []
  const topAxis = axisKeys.length > 0 ? axisKeys.reduce((a, b) => a[1] > b[1] ? a : b) : null
  const bottomAxis = axisKeys.length > 0 ? axisKeys.reduce((a, b) => a[1] < b[1] ? a : b) : null

  const AXIS_LABELS: Record<string, string> = {
    communication: "의사소통", problemSolving: "문제해결", logicalThinking: "논리적 사고",
    jobExpertise: "직무 전문성", cultureFit: "조직 적합성", leadership: "리더십",
    creativity: "창의성", sincerity: "성실성",
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <motion.div variants={containerVariants} initial="hidden" animate="show">
        {/* 인사 헤더 */}
        <motion.div variants={itemVariants} className="mb-7">
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            안녕하세요,{" "}
            <span
              className="font-extrabold"
              style={{
                background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {userName ?? "사용자"}
            </span>
            님
          </h2>
          <p className="text-gray-500 mt-1">오늘도 한 걸음 더 성장하세요.</p>
        </motion.div>

        {/* 통계 5카드 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-5">
          {[
            { iconBg: "#EDE9FE", label: "총 면접 횟수", value: `${sessions.length}`, sub: "누적 횟수", valueColor: null, grad: true, Icon: MessageSquare, iconColor: "#7C3AED" },
            { iconBg: "#E0E7FF", label: "평균 점수", value: avgScore !== null ? `${avgScore}점` : "—", sub: "8축 기준", valueColor: "#4F46E5", grad: false, Icon: TrendingUp, iconColor: "#4F46E5" },
            { iconBg: "#CFFAFE", label: "업로드 이력서", value: `${resumeCount}`, sub: "저장된 이력서", valueColor: "#06B6D4", grad: false, Icon: FileText, iconColor: "#06B6D4" },
            { iconBg: "#D1FAE5", label: "성장률", value: growthRate !== null ? `${growthRate > 0 ? "+" : ""}${growthRate}점` : "—", sub: "최근 vs 이전", valueColor: "#10B981", grad: false, Icon: BarChart2, iconColor: "#10B981" },
            { iconBg: "#FEF3C7", label: "연속 면접", value: streak > 0 ? `${streak}일` : "—", sub: streak > 0 ? "일 연속 달성!" : "오늘 시작해보세요", valueColor: "#D97706", grad: false, Icon: Flame, iconColor: "#D97706" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              className="bg-white/90 backdrop-blur-sm border border-black/[0.08] rounded-2xl p-5 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] transition-all duration-200"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ background: stat.iconBg }}>
                <stat.Icon className="w-5 h-5" style={{ color: stat.iconColor }} />
              </div>
              <p
                className="text-3xl font-extrabold tracking-tight"
                style={stat.grad
                  ? { background: "linear-gradient(135deg,#7C3AED,#4F46E5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }
                  : { color: stat.valueColor ?? "#111827" }
                }
              >
                {stat.value}
              </p>
              <p className="text-sm font-semibold text-gray-700 mt-2">{stat.label}</p>
              <p className="text-[11px] text-gray-400">{stat.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* 메인 2열 */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          {/* 최근 면접 기록 */}
          <motion.div
            variants={itemVariants}
            className="bg-white/90 backdrop-blur-sm border border-black/[0.08] rounded-2xl p-6 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">최근 면접 기록</h3>
              <Link href="/growth" className="text-violet-600 font-semibold text-sm hover:underline">전체 보기</Link>
            </div>

            {/* 30일 캘린더 히트맵 */}
            <div className="bg-white/90 backdrop-blur-sm border border-black/[0.08] rounded-2xl p-5 mb-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">최근 30일 면접 현황</h3>
              </div>
              <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(30, 1fr)" }}>
                {Object.entries(heatmap).map(([date, count]) => {
                  const bg = count === 0 ? "#E5E7EB" : count === 1 ? "#DDD6FE" : count === 2 ? "#8B5CF6" : "#5B21B6"
                  return (
                    <div
                      key={date}
                      className="rounded-sm aspect-square relative group cursor-default"
                      style={{ background: bg }}
                      title={`${date}: ${count}회`}
                    />
                  )
                })}
              </div>
              <div className="flex items-center gap-2 mt-2 justify-end">
                {[["#E5E7EB","0회"],["#DDD6FE","1회"],["#8B5CF6","2회"],["#5B21B6","3회+"]].map(([color,label]) => (
                  <div key={label} className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                    <span className="text-[10px] text-gray-400">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {sessions.length === 0 ? (
              <div className="py-4">
                <div className="text-center mb-4">
                  <div className="text-3xl mb-2">🎯</div>
                  <p className="text-sm font-semibold text-gray-700">첫 AI 면접을 시작해보세요</p>
                  <p className="text-xs text-gray-400 mt-1">3단계만 완료하면 맞춤 피드백을 받을 수 있어요</p>
                </div>
                <div className="space-y-2">
                  {[
                    { step: 1, label: "이력서 업로드", done: resumeCount > 0, cta: resumeCount === 0 ? { href: "/resumes", text: "업로드하기 →" } : null },
                    { step: 2, label: "첫 AI 면접 시작", done: false, cta: { href: "/interview/new", text: "시작하기 →" } },
                    { step: 3, label: "리포트 확인", done: false, cta: null },
                  ].map(({ step, label, done, cta }) => (
                    <div key={step} className={`flex items-center gap-3 p-3 rounded-xl border ${done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${done ? "bg-emerald-500 text-white" : "bg-slate-300 text-slate-500"}`}>
                        {done ? "✓" : step}
                      </div>
                      <span className={`text-xs font-medium flex-1 ${done ? "text-emerald-700 line-through" : "text-slate-700"}`}>{label}</span>
                      {cta && !done && (
                        <Link href={cta.href} className="text-[11px] font-semibold text-violet-600 hover:underline">{cta.text}</Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-h-[480px] overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
              {sessions.map((s) => {
                const sc = getScoreCircleClass(s.reportTotalScore)
                return (
                  <div key={s.id} className="flex items-center justify-between py-3.5 border-b border-black/[0.05] last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full flex items-center justify-center text-base font-extrabold shrink-0"
                        style={{ background: sc.bg, color: sc.color }}>
                        {s.reportTotalScore}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{s.resumeFileName || "이력서"}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(s.createdAt)}</p>
                      </div>
                    </div>
                    <Link href={`/interview/${s.id}/report`} className="text-violet-600 font-semibold text-xs hover:underline">
                      결과 보기 →
                    </Link>
                  </div>
                )
              })}
              </div>
            )}
          </motion.div>

          {/* 퀵 액션 */}
          <div className="flex flex-col gap-3">
            <motion.div
              variants={itemVariants}
              className="rounded-2xl p-5 bg-white border-2 border-violet-200 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(124,58,237,0.12)] transition-all duration-200"
            >
              <p className="font-bold text-base mb-1.5 text-gray-900">이력서 관리</p>
              <p className="text-xs text-gray-500 mb-4">최신 이력서를 업로드하고 AI 분석을 받아보세요</p>
              <Link
                href="/resumes"
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all text-white active:scale-[0.96]"
                style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
              >
                이력서 보기 →
              </Link>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="rounded-2xl p-5 bg-white border-2 border-indigo-200 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(79,70,229,0.12)] transition-all duration-200"
            >
              <p className="font-bold text-base mb-1.5 text-gray-900">면접 시작하기</p>
              <p className="text-xs text-gray-500 mb-4">AI 면접관과 함께 실전 같은 면접을 연습하세요</p>
              <Link
                href="/interview/new"
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all text-white active:scale-[0.96]"
                style={{ background: "linear-gradient(135deg, #4F46E5, #4338CA)" }}
              >
                면접 시작 →
              </Link>
            </motion.div>

            {isAdmin && (
              <motion.div
                variants={itemVariants}
                className="rounded-2xl p-5 bg-white border-2 border-emerald-200 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(16,185,129,0.12)] transition-all duration-200"
              >
                <p className="font-bold text-base mb-1.5 text-gray-900">LLM 운영 현황</p>
                <p className="text-xs text-gray-500 mb-4">API 호출·latency·에러율 모니터링</p>
                <Link
                  href="/dashboard/observability"
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all text-white active:scale-[0.96]"
                  style={{ background: "linear-gradient(135deg, #10B981, #059669)" }}
                >
                  현황 보기 →
                </Link>
              </motion.div>
            )}

            <motion.div
              variants={itemVariants}
              className="bg-white/90 backdrop-blur-sm border border-black/[0.08] rounded-2xl p-5 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] transition-all duration-200"
            >
              <p className="text-sm font-bold text-gray-900 mb-3">최근 분석 요약</p>
              {latestSession && topAxis && bottomAxis ? (
                <>
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-gray-500">강점</span>
                    <span className="text-xs font-semibold text-emerald-600">{AXIS_LABELS[topAxis[0]]} {topAxis[1]}점</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">개선 포인트</span>
                    <span className="text-xs font-semibold text-amber-600">{AXIS_LABELS[bottomAxis[0]]} {bottomAxis[1]}점</span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-400">면접을 완료하면 표시됩니다</p>
              )}
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
