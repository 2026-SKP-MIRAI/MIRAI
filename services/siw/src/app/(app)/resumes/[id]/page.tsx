"use client"
import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import { ChevronLeft, Download, TrendingUp, TrendingDown, Lightbulb } from "lucide-react"

type InterviewSummary = {
  id: string
  createdAt: string
  reportTotalScore: number
  scores: Record<string, number>
}

type ResumeFeedbackScores = {
  specificity: number
  achievementClarity: number
  logicStructure: number
  roleAlignment: number
  differentiation: number
}

type SuggestionItem = {
  section: string
  issue: string
  suggestion: string
}

type ResumeFeedback = {
  scores: ResumeFeedbackScores
  strengths: string[]
  weaknesses: string[]
  suggestions: SuggestionItem[]
}

const SCORE_LABELS: Record<keyof ResumeFeedbackScores, string> = {
  specificity: "경험·사례의 구체성",
  achievementClarity: "성과의 명확성",
  logicStructure: "논리 구조",
  roleAlignment: "직무 연관성",
  differentiation: "차별화",
}

const AXIS_LABELS: Record<string, string> = {
  communication: "의사소통",
  problemSolving: "문제해결",
  logicalThinking: "논리적 사고",
  jobExpertise: "직무 전문성",
  cultureFit: "조직 적합성",
  leadership: "리더십",
  creativity: "창의성",
  sincerity: "성실성",
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.065 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: "easeOut" as const } },
}

type ResumeItem = {
  id: string
  fileName: string
  uploadedAt: string
  questionCount: number
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
}


export default function ResumeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [resume, setResume] = useState<ResumeItem | null>(null)
  const [sessions, setSessions] = useState<InterviewSummary[]>([])
  const [feedback, setFeedback] = useState<ResumeFeedback | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/resumes/${id}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/resumes/${id}/sessions`).then(r => r.ok ? r.json() : []),
      fetch(`/api/resumes/${id}/feedback`).then(r => r.ok ? r.json() : null),
    ]).then(([resumeData, sessionsData, feedbackData]: [ResumeItem | null, InterviewSummary[], ResumeFeedback | null]) => {
      setResume(resumeData)
      setSessions(Array.isArray(sessionsData) ? sessionsData : [])
      setFeedback(feedbackData)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/resumes/${id}/download`)
      if (!res.ok) throw new Error("다운로드 실패")
      const { url, fileName } = await res.json()
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      a.target = "_blank"
      a.rel = "noopener noreferrer"
      a.click()
    } catch {
      alert("다운로드에 실패했습니다. 다시 시도해 주세요.")
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-40 rounded-2xl bg-gray-100 animate-pulse" />)}
      </div>
    )
  }

  if (!resume) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 text-center">
        <p className="text-gray-500">이력서를 찾을 수 없습니다.</p>
        <Link href="/resumes" className="mt-4 inline-block text-violet-600 font-semibold text-sm hover:underline">
          목록으로 돌아가기
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* 뒤로가기 */}
      <Link
        href="/resumes"
        className="inline-flex items-center gap-1.5 text-gray-500 text-sm font-semibold hover:text-gray-900 transition-colors mb-5"
      >
        <ChevronLeft className="w-4 h-4" />
        내 이력서
      </Link>

      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">{resume.fileName}</h1>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800">분석 완료</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">{formatDate(resume.uploadedAt)} 저장</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {downloading ? "..." : "내 이력서"}
          </button>
          <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-95">
            수정
          </button>
          <Link
            href={`/interview/new?resumeId=${resume.id}`}
            className="text-white rounded-full px-4 py-2 text-sm font-semibold shadow-[0_4px_14px_rgba(124,58,237,0.35)] hover:-translate-y-px active:scale-95 transition-all"
            style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
          >
            면접 시작 →
          </Link>
        </div>
      </div>

      <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-5">
        {/* 자소서 분석 결과 */}
        <motion.div
          variants={itemVariants}
          className="bg-white/90 backdrop-blur-sm border border-black/[0.08] rounded-2xl p-6 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] transition-all duration-200"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">자소서 분석 결과</h2>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-violet-100 text-violet-700">AI 진단</span>
          </div>
          {!feedback ? (
            <div className="bg-gray-50 rounded-xl p-5 text-center border border-black/[0.05]">
              <p className="text-sm text-gray-400">분석 결과가 없습니다. 이력서를 업로드하면 자동으로 분석됩니다.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 5개 점수 바 */}
              <div className="space-y-2.5">
                {(Object.keys(SCORE_LABELS) as (keyof ResumeFeedbackScores)[]).map(key => {
                  const score = feedback.scores[key]
                  const color = score >= 80
                    ? "linear-gradient(90deg,#10B981,#34D399)"
                    : score >= 60
                    ? "linear-gradient(90deg,#7C3AED,#9B59E8)"
                    : "linear-gradient(90deg,#F59E0B,#D97706)"
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-[130px] text-xs text-gray-700 shrink-0">{SCORE_LABELS[key]}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, background: color }} />
                      </div>
                      <span className="w-8 text-right text-xs font-bold text-gray-900 shrink-0">{score}</span>
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 강점 */}
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                  <div className="flex items-center gap-1.5 mb-3">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-bold text-emerald-800">강점</span>
                  </div>
                  <ul className="space-y-2">
                    {feedback.strengths.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm text-emerald-900 leading-relaxed">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 약점 */}
                <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                  <div className="flex items-center gap-1.5 mb-3">
                    <TrendingDown className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-bold text-red-700">개선 필요</span>
                  </div>
                  <ul className="space-y-2">
                    {feedback.weaknesses.map((w, i) => (
                      <li key={i} className="flex gap-2 text-sm text-red-900 leading-relaxed">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 개선 제안 */}
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-bold text-gray-900">개선 제안</span>
                </div>
                <div className="space-y-2.5">
                  {feedback.suggestions.map((sg, i) => (
                    <div key={i} className="bg-amber-50 rounded-xl px-4 py-3.5 border border-amber-100">
                      <p className="text-[11px] font-bold text-amber-700 mb-1">{sg.section}</p>
                      <p className="text-xs text-gray-600 mb-1.5"><span className="font-semibold text-gray-700">문제: </span>{sg.issue}</p>
                      <p className="text-xs text-gray-700 leading-relaxed"><span className="font-semibold">제안: </span>{sg.suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* 8축 역량 평가 */}
        <motion.div
          variants={itemVariants}
          className="bg-white/90 backdrop-blur-sm border border-black/[0.08] rounded-2xl p-6 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] transition-all duration-200"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">8축 역량 평가</h2>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-violet-100 text-violet-700">
              {sessions.length > 0 ? `${sessions.length}회 면접 기준` : "면접 기록 없음"}
            </span>
          </div>
          {sessions.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-5 text-center border border-black/[0.05]">
              <p className="text-sm text-gray-400">이 이력서로 면접을 완료하면 역량 평가가 표시됩니다.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {Object.keys(AXIS_LABELS).map(key => {
                const avg = Math.round(sessions.reduce((sum, s) => sum + (s.scores?.[key] ?? 0), 0) / sessions.length)
                const color = avg >= 80 ? "linear-gradient(90deg,#10B981,#34D399)"
                  : avg >= 65 ? "linear-gradient(90deg,#7C3AED,#9B59E8)"
                  : "linear-gradient(90deg,#F59E0B,#D97706)"
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-[90px] text-xs text-gray-700 shrink-0">{AXIS_LABELS[key]}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${avg}%`, background: color }} />
                    </div>
                    <span className="w-8 text-right text-xs font-bold text-gray-900 shrink-0">{avg}점</span>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>

        {/* 성장 요약 */}
        <motion.div
          variants={itemVariants}
          className="bg-white/90 backdrop-blur-sm border border-black/[0.08] rounded-2xl p-6 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] transition-all duration-200"
        >
          <h2 className="text-lg font-bold text-gray-900 mb-4">성장 요약</h2>
          {sessions.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-5 text-center border border-black/[0.05]">
              <p className="text-sm text-gray-400">이 이력서로 면접을 완료하면 성장 기록이 표시됩니다.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s, i) => (
                <Link
                  key={s.id}
                  href={`/interview/${s.id}/report`}
                  className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-gray-50 transition-all"
                >
                  <div>
                    <p className="text-xs font-semibold text-gray-900">
                      {i === 0 ? "최근" : `${i + 1}회 전`} — {new Date(s.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {i < sessions.length - 1 && (
                      <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${
                        s.reportTotalScore - sessions[i + 1].reportTotalScore >= 0
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}>
                        {s.reportTotalScore - sessions[i + 1].reportTotalScore >= 0 ? "+" : ""}
                        {s.reportTotalScore - sessions[i + 1].reportTotalScore}점
                      </span>
                    )}
                    <span className="text-sm font-bold text-gray-900">{s.reportTotalScore}점</span>
                    <span className="text-xs text-violet-600 font-semibold">리포트 →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}
