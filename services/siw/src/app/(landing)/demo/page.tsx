"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

// ─── 타입 ─────────────────────────────────────────────────────────────────

type Step = "select" | "answering" | "loading" | "result" | "ratelimit" | "error"

interface FeedbackResult {
  score?: number
  strengths?: string[]
  improvements?: string[]
  modelAnswer?: string
  [key: string]: unknown
}

interface EvaluateResult {
  scores?: Record<string, number>
  totalScore?: number
  [key: string]: unknown
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

const AXIS_LABELS: Record<string, string> = {
  communication: "의사소통",
  problem_solving: "문제해결",
  logical_thinking: "논리적 사고",
  job_expertise: "직무 전문성",
  organizational_fit: "조직 적합성",
  leadership: "리더십",
  creativity: "창의성",
  diligence: "성실성",
}

function getAxisLabel(key: string): string {
  return AXIS_LABELS[key] ?? key
}

// ─── 점수 바 ──────────────────────────────────────────────────────────────

function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = Math.min(100, Math.max(0, score))
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-xs text-[#6B7280] shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-400 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs font-semibold text-[#4F46E5]">{score}</span>
    </div>
  )
}

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
  const [rateLimitMsg, setRateLimitMsg] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  // Step 1: 직무 선택 → 질문 생성
  const handleSelectRole = async (role: string) => {
    setTargetRole(role)
    setStep("loading")
    try {
      const res = await fetch("/api/demo/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole: role }),
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
    } catch {
      setErrorMsg("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")
      setStep("error")
    }
  }

  // Step 2: 답변 제출 → 피드백 + 평가 병렬 호출
  const handleSubmit = async () => {
    if (!answer.trim()) return
    setStep("loading")
    try {
      const [fbRes, evRes] = await Promise.all([
        fetch("/api/demo/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, answer }),
        }),
        fetch("/api/demo/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetRole, question, answer, persona }),
        }),
      ])

      if (!fbRes.ok || !evRes.ok) {
        setErrorMsg("분석에 실패했습니다. 잠시 후 다시 시도해주세요.")
        setStep("error")
        return
      }

      const [fbData, evData] = await Promise.all([fbRes.json(), evRes.json()])
      setFeedback(fbData)
      setEvaluation(evData)
      setStep("result")
    } catch {
      setErrorMsg("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")
      setStep("error")
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/6">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link href="/" className="text-xl font-bold gradient-text">
            ← MirAI
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">

        {/* ── SELECT ────────────────────────────────────────────────────── */}
        {step === "select" && (
          <div className="space-y-10">
            <div className="text-center space-y-3">
              <span className="tag tag-purple inline-flex items-center gap-1.5">
                <span className="text-purple-400">✦</span>
                무료 데모 체험
              </span>
              <h1 className="text-3xl md:text-4xl font-bold text-[#111827]">
                어떤 직무로{" "}
                <span className="gradient-text">면접을 체험</span>
                할까요?
              </h1>
              <p className="text-[#6B7280] text-sm">
                하루 최대 3회 무료로 체험할 수 있습니다. 가입하면 무제한으로 이용할 수 있어요.
              </p>
            </div>

            {/* 입력 폼 */}
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
                className="w-full btn-primary rounded-2xl py-4 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                면접 질문 받기 →
              </button>
            </form>

            {/* 빠른 선택 */}
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

        {/* ── ANSWERING ─────────────────────────────────────────────────── */}
        {step === "answering" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <span className="tag tag-blue inline-flex items-center gap-1.5 text-xs">
                {targetRole}
              </span>
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
              className="w-full btn-primary rounded-xl py-3 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              답변 제출하기 →
            </button>
          </div>
        )}

        {/* ── LOADING ───────────────────────────────────────────────────── */}
        {step === "loading" && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-violet-200 border-t-violet-500 animate-spin" />
            <p className="text-[#6B7280] text-sm">AI가 분석 중입니다...</p>
          </div>
        )}

        {/* ── RESULT ────────────────────────────────────────────────────── */}
        {step === "result" && feedback && evaluation && (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-[#111827]">
                <span className="gradient-text">면접 분석 결과</span>
              </h2>
              <p className="text-sm text-[#6B7280]">{targetRole} · AI 피드백</p>
            </div>

            {/* 종합 점수 */}
            {typeof feedback.score === "number" && (
              <div className="glass-card rounded-2xl p-6 text-center">
                <p className="text-xs text-[#9CA3AF] mb-1">종합 점수</p>
                <p className="text-5xl font-extrabold gradient-text">{feedback.score}</p>
                <p className="text-xs text-[#9CA3AF] mt-1">/ 100</p>
              </div>
            )}

            {/* 잘한 점 */}
            {Array.isArray(feedback.strengths) && feedback.strengths.length > 0 && (
              <div className="glass-card rounded-2xl p-6 space-y-3">
                <h3 className="font-semibold text-[#111827] flex items-center gap-2">
                  <span className="text-emerald-500">✓</span> 잘한 점
                </h3>
                <ul className="space-y-2">
                  {feedback.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-[#374151] flex items-start gap-2">
                      <span className="text-emerald-400 mt-0.5 shrink-0">•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 개선점 */}
            {Array.isArray(feedback.improvements) && feedback.improvements.length > 0 && (
              <div className="glass-card rounded-2xl p-6 space-y-3">
                <h3 className="font-semibold text-[#111827] flex items-center gap-2">
                  <span className="text-amber-500">△</span> 개선점
                </h3>
                <ul className="space-y-2">
                  {feedback.improvements.map((s, i) => (
                    <li key={i} className="text-sm text-[#374151] flex items-start gap-2">
                      <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 모범 답안 */}
            {feedback.modelAnswer && (
              <div className="glass-card rounded-2xl p-6 space-y-3 border-l-4 border-l-indigo-300">
                <h3 className="font-semibold text-[#111827]">모범 답안 가이드</h3>
                <p className="text-sm text-[#374151] leading-relaxed">{String(feedback.modelAnswer)}</p>
              </div>
            )}

            {/* 8축 점수 */}
            {evaluation.scores && typeof evaluation.scores === "object" && (
              <div className="glass-card rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold text-[#111827]">8축 역량 분석</h3>
                {typeof evaluation.totalScore === "number" && (
                  <p className="text-xs text-[#6B7280]">
                    총점: <span className="font-bold text-[#4F46E5]">{evaluation.totalScore}</span>점
                  </p>
                )}
                <div className="space-y-3">
                  {Object.entries(evaluation.scores).map(([key, val]) => (
                    <ScoreBar
                      key={key}
                      label={getAxisLabel(key)}
                      score={typeof val === "number" ? val : 0}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* CTA 버튼 */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => router.push("/signup")}
                className="flex-1 btn-primary rounded-xl py-3 text-sm font-semibold"
              >
                전체 면접 시작하기 →
              </button>
              <button
                onClick={() => router.push("/login")}
                className="flex-1 btn-outline rounded-xl py-3 text-sm font-semibold"
              >
                로그인
              </button>
            </div>
          </div>
        )}

        {/* ── RATE LIMIT ────────────────────────────────────────────────── */}
        {step === "ratelimit" && (
          <div className="flex flex-col items-center justify-center py-24 space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center text-2xl">
              ⏰
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[#111827]">오늘 무료 체험 3회를 모두 사용했습니다.</h2>
              <p className="text-sm text-[#6B7280]">{rateLimitMsg}</p>
            </div>
            <button
              onClick={() => router.push("/signup")}
              className="btn-primary rounded-xl px-8 py-3 text-sm font-semibold"
            >
              가입하러 가기 →
            </button>
          </div>
        )}

        {/* ── ERROR ─────────────────────────────────────────────────────── */}
        {step === "error" && (
          <div className="flex flex-col items-center justify-center py-24 space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-2xl">
              ⚠️
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[#111827]">오류가 발생했습니다</h2>
              <p className="text-sm text-[#6B7280]">{errorMsg}</p>
            </div>
            <button
              onClick={() => setStep("select")}
              className="btn-outline rounded-xl px-8 py-3 text-sm font-semibold"
            >
              다시 시도하기
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
