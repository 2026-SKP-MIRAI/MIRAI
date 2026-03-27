"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js"
import { Radar } from "react-chartjs-2"

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

// ─── 타입 ─────────────────────────────────────────────────────────────────

type Step = "select" | "answering" | "loading" | "result" | "ratelimit" | "error"

interface FeedbackResult {
  score?: number
  feedback?: { good?: string[]; improve?: string[] }
  keywords?: string[]
  improvedAnswerGuide?: string
  [key: string]: unknown
}

interface AxisFeedback {
  axis: string
  axisLabel: string
  score: number | null
  type: "strength" | "improvement" | "not_evaluated"
  feedback: string
}

interface EvaluateResult {
  scores?: Record<string, number>
  totalScore?: number
  summary?: string
  axisFeedbacks?: AxisFeedback[]
}

// ─── 상수 ─────────────────────────────────────────────────────────────────

const ROLE_SUGGESTIONS = [
  "프론트엔드 개발자",
  "백엔드 개발자",
  "기획자(PM)",
  "데이터 분석가",
  "디자이너",
  "마케터",
]

const PERSONA_LABELS: Record<string, string> = {
  hr: "HR 담당자",
  tech_lead: "기술팀장",
  executive: "경영진",
}


const ALL_AXIS_LABELS: Record<string, string> = {
  communication: "의사소통",
  problemSolving: "문제해결",
  logicalThinking: "논리적 사고",
  jobExpertise: "직무 전문성",
  cultureFit: "조직 적합성",
  leadership: "리더십",
  creativity: "창의성",
  sincerity: "성실성",
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────


function getBarStyle(score: number): React.CSSProperties {
  if (score >= 85) return { background: "linear-gradient(90deg, #10B981, #34D399)", width: `${score}%` }
  if (score >= 65) return { background: "linear-gradient(90deg, #7C3AED, #9B59E8)", width: `${score}%` }
  return { background: "linear-gradient(90deg, #F59E0B, #FCD34D)", width: `${score}%` }
}

function getScoreColor(score: number): string {
  if (score >= 85) return "#10B981"
  if (score >= 65) return "#7C3AED"
  return "#F59E0B"
}

const RADAR_OPTIONS = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: { legend: { display: false } },
  scales: {
    r: {
      min: 0,
      max: 100,
      ticks: { stepSize: 20, font: { size: 9 }, color: "#9CA3AF" as const, backdropColor: "transparent" as const },
      grid: { color: "rgba(0,0,0,0.07)" },
      angleLines: { color: "rgba(0,0,0,0.07)" },
      pointLabels: { font: { size: 13, weight: 600 as const }, color: "#374151" as const },
    },
  },
}

const AXIS_KEYS = Object.keys(ALL_AXIS_LABELS)

// ─── 메인 페이지 ──────────────────────────────────────────────────────────

export default function DemoPage() {
  const router = useRouter()

  const [step, setStep] = useState<Step>("select")
  const [roleInput, setRoleInput] = useState("")
  const [targetRole, setTargetRole] = useState("")
  const [question, setQuestion] = useState("")
  const [persona, setPersona] = useState("")
  const [answer, setAnswer] = useState("")
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null)
  const [evaluation, setEvaluation] = useState<EvaluateResult | null>(null)
  const [activeTab, setActiveTab] = useState<"summary" | "improvements">("summary")
  const [activeAxis, setActiveAxis] = useState<string | null>(null)
  const [expandedAxis, setExpandedAxis] = useState<string | null>(null)
  const [rateLimitMsg, setRateLimitMsg] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  const handleEnter = useCallback((axis: string) => setActiveAxis(axis), [])
  const handleLeave = useCallback(() => setActiveAxis(null), [])
  const handleClick = useCallback((axis: string) => setExpandedAxis((prev) => prev === axis ? null : axis), [])

  const handleSelectRole = async (role: string) => {
    setTargetRole(role)
    setStep("loading")
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    try {
      const res = await fetch("/api/demo/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole: role }),
        signal: abortRef.current.signal,
      })
      if (res.status === 429) {
        const data = await res.json()
        setRateLimitMsg(data.message ?? "오늘 무료 체험 3회를 모두 사용했습니다.")
        setStep("ratelimit")
        return
      }
      if (!res.ok) {
        setErrorMsg("질문 생성에 실패했습니다. 잠시 후 다시 시도해주세요.")
        setStep("error")
        return
      }
      const data = await res.json()
      setQuestion(data.question)
      setPersona(data.persona ?? "hr")
      setStep("answering")
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return
      setErrorMsg("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")
      setStep("error")
    }
  }

  const handleSubmit = async () => {
    if (!answer.trim()) return
    setStep("loading")
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal
    try {
      const [fbRes, evRes] = await Promise.all([
        fetch("/api/demo/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, answer }),
          signal,
        }),
        fetch("/api/demo/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetRole, question, answer, persona }),
          signal,
        }),
      ])

      if (!fbRes.ok && !evRes.ok) {
        setErrorMsg("분석에 실패했습니다. 잠시 후 다시 시도해주세요.")
        setStep("error")
        return
      }
      const fbData = fbRes.ok ? await fbRes.json() : null
      const evData = evRes.ok ? await evRes.json() : null
      setFeedback(fbData)
      setEvaluation(evData)
      setStep("result")
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return
      setErrorMsg("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")
      setStep("error")
    }
  }

  // 레이더 차트 데이터
  const radarData = useMemo(() => ({
    labels: AXIS_KEYS.map((k) => ALL_AXIS_LABELS[k]),
    datasets: [
      {
        label: "8축 점수",
        data: AXIS_KEYS.map((k) => evaluation?.scores?.[k] ?? 0),
        backgroundColor: "rgba(124,58,237,0.15)",
        borderColor: "#7C3AED",
        borderWidth: 2,
        pointBackgroundColor: "#7C3AED",
        pointBorderColor: "white",
        pointBorderWidth: 2,
        pointRadius: 4,
      },
    ],
  }), [evaluation?.scores])

  const topAxes = useMemo(
    () => evaluation?.axisFeedbacks
      ?.filter(f => f.score != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 3)
      .map(f => f.axis) ?? [],
    [evaluation?.axisFeedbacks]
  )

  const demoAxesFeedbacks = useMemo(
    () => evaluation?.axisFeedbacks?.filter((f) => topAxes.includes(f.axis)) ?? [],
    [evaluation?.axisFeedbacks, topAxes]
  )
  const improvements = useMemo(
    () => evaluation?.axisFeedbacks?.filter((f) => topAxes.includes(f.axis) && f.type === "improvement").slice(0, 5) ?? [],
    [evaluation?.axisFeedbacks, topAxes]
  )
  const strengths = useMemo(
    () => evaluation?.axisFeedbacks?.filter((f) => topAxes.includes(f.axis) && f.type === "strength").slice(0, 5) ?? [],
    [evaluation?.axisFeedbacks, topAxes]
  )

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      {/* NAV */}
      <header className="glass-panel sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <Link href="/" className="text-xl font-bold gradient-text">← MirAI</Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* SELECT */}
        {step === "select" && (
          <div className="max-w-xl mx-auto space-y-10">
            <div className="text-center space-y-3">
              <span className="tag tag-purple inline-flex items-center gap-1.5">
                <span className="text-purple-400">✦</span>무료 데모 체험
              </span>
              <h1 className="text-3xl md:text-4xl font-bold text-[#111827]">
                어떤 직무로 <span className="gradient-text">면접을 체험</span>할까요?
              </h1>
              <p className="text-[#6B7280] text-sm">하루 최대 3회 무료. 가입하면 무제한으로 이용할 수 있어요.</p>
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); if (roleInput.trim()) handleSelectRole(roleInput.trim()) }}
              className="space-y-4"
            >
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value)}
                  placeholder="지원 직무를 입력하세요 (예: 프론트엔드 개발자)"
                  className="w-full rounded-2xl border border-[#E5E7EB] pl-11 pr-4 py-4 text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all duration-200 shadow-sm"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={!roleInput.trim()}
                className="w-full btn-primary rounded-2xl py-4 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                면접 질문 받기 →
              </button>
            </form>

            <div className="space-y-3">
              <p className="text-xs text-[#9CA3AF] text-center">또는 빠르게 선택하세요</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {ROLE_SUGGESTIONS.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setRoleInput(role)}
                    className={`px-4 py-2 rounded-full text-xs font-medium border transition-all duration-150 ${
                      roleInput === role
                        ? "border-violet-400 bg-violet-50 text-violet-700"
                        : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ANSWERING */}
        {step === "answering" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="tag tag-blue inline-flex items-center gap-1 text-xs">{targetRole}</span>
                <span className="tag tag-purple inline-flex items-center gap-1 text-xs">
                  {PERSONA_LABELS[persona] ?? persona}
                </span>
              </div>
              <h2 className="text-xl font-bold text-[#111827]">면접 질문</h2>
            </div>

            <div className="glass-card rounded-2xl p-6 border-l-4 border-l-violet-400">
              <p className="text-[#1F2937] leading-relaxed font-medium">{question}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#374151]">내 답변</label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="답변을 입력해주세요..."
                rows={6}
                className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 text-sm text-[#111827] resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent transition-all"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!answer.trim()}
              className="w-full btn-primary rounded-xl py-3 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              답변 제출하기 →
            </button>
          </div>
        )}

        {/* LOADING */}
        {step === "loading" && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <span className="w-10 h-10 border-2 border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin" />
            <p className="text-sm text-[#9CA3AF]">AI가 분석 중입니다... (최대 30초 소요됩니다)</p>
          </div>
        )}

        {/* RESULT */}
        {step === "result" && (
          <div className="flex flex-col gap-6">
            {/* 헤더 */}
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold text-[#111827]"><span className="gradient-text">면접 분석 결과</span></h2>
              <p className="text-sm text-[#6B7280]">{targetRole} · {PERSONA_LABELS[persona] ?? persona}</p>
            </div>

            {/* 이번 답변 점수 */}
            {typeof feedback?.score === "number" && (
              <div className="rounded-2xl p-5 md:p-8 text-center text-white" style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}>
                <p className="text-sm opacity-80 mb-3">이번 답변 점수</p>
                <p className="font-black leading-none mb-1 text-[48px] md:text-[80px] tracking-[-3px]">
                  {feedback.score}
                </p>
                <p className="text-base opacity-85">/ 100점</p>
              </div>
            )}

            {/* 탭 */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {(["summary", "improvements"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    activeTab === tab ? "bg-white text-violet-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab === "summary" ? "총평" : "개선점"}
                </button>
              ))}
            </div>

            {/* 총평 탭 */}
            {activeTab === "summary" && (
              <div className="flex flex-col gap-4">
                <div className="bg-white/90 backdrop-blur-sm border border-black/[0.08] rounded-2xl p-4 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-10 items-start">

                    {/* 레이더 차트 — 블러 + 오버레이 */}
                    <div className="relative order-last md:order-none">
                      <p className="text-sm font-semibold text-gray-500 mb-4 text-center">8축 역량 레이더</p>
                      <div className="relative max-w-full md:max-w-[420px] mx-auto">
                        <div className="blur-sm pointer-events-none select-none">
                          <Radar data={radarData} options={RADAR_OPTIONS} />
                        </div>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                          <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-3 py-3 md:px-5 md:py-4 shadow-sm border border-violet-100">
                            <p className="text-xs font-semibold text-[#374151] leading-relaxed">
                              전체 8축 평가는<br />모든 면접을 진행 후 확인 가능합니다
                            </p>
                            <button
                              onClick={() => router.push("/signup")}
                              className="mt-3 btn-primary rounded-lg px-4 py-1.5 text-xs font-semibold"
                            >
                              가입하기 →
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3축 점수 — 인터랙티브 score-grid */}
                    <div
                      className={`score-grid-wrapper${activeAxis !== null ? " score-grid-hovered" : ""}`}
                      onMouseLeave={handleLeave}
                    >
                      <div className="score-grid__summary">
                        <span className="score-grid__summary-label">이번 질문 평가 역량</span>
                        <div className="score-grid__summary-values">
                          {typeof feedback?.score === "number" && (
                            <>
                              <span className="score-grid__summary-current">{feedback.score}</span>
                              <span className="score-grid__summary-label" style={{ marginLeft: 4 }}>/ 100</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="score-grid__divider" />
                      <div className="score-grid__list">
                        {demoAxesFeedbacks.length > 0 ? demoAxesFeedbacks.map((item) => (
                          <div
                            key={item.axis}
                            className="axis-row cursor-pointer"
                            data-active={activeAxis === item.axis}
                            data-inactive={activeAxis !== null && activeAxis !== item.axis}
                            onMouseEnter={() => handleEnter(item.axis)}
                            onMouseLeave={handleLeave}
                            onClick={() => handleClick(item.axis)}
                          >
                            <div className="axis-row__header">
                              <div className="axis-row__meta">
                                <span className="axis-row__name">{item.axisLabel}</span>
                              </div>
                              <div className="axis-row__scores">
                                <span className="axis-row__current-score" style={{ color: item.score != null ? getScoreColor(item.score) : undefined }}>
                                  {item.score}점
                                </span>
                              </div>
                            </div>
                            <div className="axis-row__track">
                              <div className="axis-row__bar-current" style={item.score != null ? getBarStyle(item.score) : undefined} aria-hidden="true" />
                            </div>
                            <p
                              className="axis-row__desc"
                              style={expandedAxis === item.axis
                                ? { opacity: 1, maxHeight: "none", overflow: "visible", WebkitLineClamp: "unset" }
                                : { WebkitLineClamp: 1, display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden" }
                              }
                            >
                              {item.feedback}
                            </p>
                          </div>
                        )) : Object.keys(ALL_AXIS_LABELS).slice(0, 3).map((axis) => (
                          <div key={axis} className="axis-row opacity-40">
                            <div className="axis-row__header">
                              <span className="axis-row__name">{ALL_AXIS_LABELS[axis]}</span>
                            </div>
                            <div className="axis-row__track">
                              <div className="axis-row__bar-current" style={{ width: "0%" }} aria-hidden="true" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI 종합 피드백 */}
                {evaluation?.summary && (
                  <div className="bg-gray-50 rounded-xl p-5 border border-black/5">
                    <p className="text-sm font-semibold text-gray-700 mb-2">AI 면접관 종합 피드백</p>
                    <p className="text-sm text-gray-600 leading-[1.8]">{evaluation.summary}</p>
                  </div>
                )}

                {/* 모범 답안 가이드 */}
                {feedback?.improvedAnswerGuide && (
                  <div className="glass-card rounded-2xl p-6 space-y-2 border-l-4 border-l-indigo-300">
                    <h3 className="font-semibold text-[#111827] text-sm">모범 답안 가이드</h3>
                    <p className="text-sm text-[#374151] leading-relaxed">{String(feedback.improvedAnswerGuide)}</p>
                  </div>
                )}
              </div>
            )}

            {/* 개선점 탭 — 잠금 */}
            {activeTab === "improvements" && (
              <div className="relative rounded-2xl overflow-hidden">
                {/* 배경 (블러) */}
                <div className="flex flex-col gap-5 blur-sm select-none pointer-events-none p-6 bg-white/90 border border-black/[0.08]">
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-semibold text-emerald-600 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />잘한 점
                    </p>
                    {[1, 2].map((i) => (
                      <div key={i} className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-white text-xs font-bold shrink-0" style={{ background: "linear-gradient(135deg, #10B981, #34D399)" }}>{i}</span>
                          <span className="font-semibold text-sm text-gray-900">역량 항목</span>
                          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800">00점</span>
                        </div>
                        <p className="text-sm text-gray-600 leading-[1.7]">피드백 내용이 여기에 표시됩니다. 가입 후 전체 분석 결과를 확인하세요.</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-semibold text-amber-600 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />개선할 점
                    </p>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-4 border border-black/[0.06]">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-white text-xs font-bold shrink-0" style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}>{i}</span>
                          <span className="font-semibold text-sm text-gray-900">역량 항목</span>
                          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-800">00점</span>
                          <span className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold bg-red-100 text-red-700">우선 개선</span>
                        </div>
                        <p className="text-sm text-gray-600 leading-[1.7]">개선 방향에 대한 AI 피드백이 여기에 표시됩니다.</p>
                      </div>
                    ))}
                  </div>
                </div>
                {/* 잠금 오버레이 */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[3px]">
                  <div className="text-center space-y-3 px-6">
                    <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center mx-auto">
                      <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-[#111827]">강점과 개선점 상세 분석은<br />가입 후 확인할 수 있어요</p>
                    <button
                      onClick={() => router.push("/signup")}
                      className="btn-primary rounded-xl px-6 py-2.5 text-sm font-semibold"
                    >
                      가입하고 전체 분석 받기 →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button onClick={() => router.push("/signup")} className="flex-1 btn-primary rounded-xl py-3 text-sm font-semibold">
                전체 면접 시작하기 →
              </button>
              <button onClick={() => router.push("/login")} className="flex-1 btn-outline rounded-xl py-3 text-sm font-semibold">
                로그인
              </button>
            </div>
          </div>
        )}

        {/* RATE LIMIT */}
        {step === "ratelimit" && (
          <div className="flex flex-col items-center justify-center py-24 space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center text-2xl">⏰</div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[#111827]">오늘 무료 체험 3회를 모두 사용했습니다.</h2>
              <p className="text-sm text-[#6B7280]">{rateLimitMsg}</p>
            </div>
            <button onClick={() => router.push("/signup")} className="btn-primary rounded-xl px-8 py-3 text-sm font-semibold">
              가입하러 가기 →
            </button>
          </div>
        )}

        {/* ERROR */}
        {step === "error" && (
          <div className="flex flex-col items-center justify-center py-24 space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-2xl">⚠️</div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[#111827]">오류가 발생했습니다</h2>
              <p className="text-sm text-[#6B7280]">{errorMsg}</p>
            </div>
            <button onClick={() => setStep("select")} className="btn-outline rounded-xl px-8 py-3 text-sm font-semibold">
              다시 시도하기
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
