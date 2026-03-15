"use client"
import React, { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Users, Code2, Briefcase } from "lucide-react"

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.065 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: "easeOut" as const } },
}

type Persona = {
  id: "hr" | "tech_lead" | "executive"
  name: string
  tag: string
  tagColor: string
  iconBg: string
  iconColor: string
  desc: string
  traits: string
  difficulty: string
  Icon: React.ElementType
}

const PERSONAS: Persona[] = [
  {
    id: "hr",
    name: "HR 담당자",
    tag: "HR",
    tagColor: "bg-emerald-100 text-emerald-800",
    iconBg: "#D1FAE5",
    iconColor: "#065F46",
    desc: "소프트 스킬, 팀워크, 조직 적합성 평가",
    traits: "STAR 기법, 가치관 탐색, 갈등 해결 경험",
    difficulty: "보통",
    Icon: Users,
  },
  {
    id: "tech_lead",
    name: "기술 팀장",
    tag: "기술",
    tagColor: "bg-blue-100 text-blue-800",
    iconBg: "#DBEAFE",
    iconColor: "#1E40AF",
    desc: "기술 깊이와 논리적 검증 중심",
    traits: "개념 정확도, 트레이드오프, 실전 문제해결",
    difficulty: "높음",
    Icon: Code2,
  },
  {
    id: "executive",
    name: "경영진",
    tag: "경영진",
    tagColor: "bg-violet-100 text-violet-800",
    iconBg: "#EDE9FE",
    iconColor: "#5B21B6",
    desc: "비즈니스 임팩트와 ROI 중심",
    traits: "비즈니스 가치, 수치 기반, 전략적 사고",
    difficulty: "매우 높음",
    Icon: Briefcase,
  },
]

type ResumeItem = { id: string; fileName: string }

export default function InterviewNewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedResumeId = searchParams.get("resumeId")

  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(preselectedResumeId)
  const [resumes, setResumes] = useState<ResumeItem[]>([])
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/resumes")
      .then(r => r.json())
      .then(setResumes)
      .catch(() => {})
  }, [])

  const selectedResume = resumes.find(r => r.id === selectedResumeId)

  async function handleStart() {
    if (!selectedResumeId || starting) return
    setStarting(true)
    setStartError(null)
    try {
      const res = await fetch("/api/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId: selectedResumeId,
          personas: ["hr", "tech_lead", "executive"],
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setStartError(json.message ?? "면접 시작에 실패했습니다. 다시 시도해주세요.")
        return
      }
      sessionStorage.setItem(`interview-first-${json.sessionId}`, JSON.stringify(json.firstQuestion))
      router.push(`/interview/${json.sessionId}`)
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
        {/* 페이지 헤더 */}
        <motion.div variants={itemVariants}>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">면접 시작하기</h1>
          <p className="text-sm text-gray-500 mt-1">페르소나를 선택하고 AI 면접을 시작하세요</p>
        </motion.div>

        {/* 안내 배너 */}
        <motion.div
          variants={itemVariants}
          className="rounded-lg px-4 py-3.5 text-sm text-gray-700 leading-[1.6]"
          style={{ background: "#F5F3FF", border: "1.5px solid #C4B5FD" }}
        >
          <strong>AI 면접관 안내:</strong> 실제 면접관의 스타일로 질문을 진행합니다. 이력서 기반으로 맞춤 질문이 생성되며, 8축 평가 기준으로 채점됩니다.
        </motion.div>

        {/* 페르소나 선택 */}
        <motion.div variants={itemVariants}>
          <h2 className="text-base font-bold text-gray-900 mb-1">면접관 소개</h2>
          <p className="text-sm text-gray-500 mb-4">HR·기술팀장·경영진 3인이 함께 면접에 참여합니다</p>
          <div className="grid grid-cols-3 gap-4">
            {PERSONAS.map(p => (
              <div
                key={p.id}
                className="text-left rounded-2xl p-5 border border-black/[0.08] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)]"
                style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)" }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: p.iconBg }}
                >
                  <p.Icon className="w-5 h-5" style={{ color: p.iconColor }} />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-gray-900 text-base">{p.name}</p>
                </div>
                <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold mb-2 ${p.tagColor}`}>{p.tag}</span>
                <p className="text-xs text-gray-500 leading-[1.6] mb-2">{p.desc}</p>
                <p className="text-[11px] text-gray-400">{p.traits}</p>
                <p className="text-[11px] text-gray-400 mt-1">난이도: <strong>{p.difficulty}</strong></p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* 이력서 선택/확인 */}
        <motion.div
          variants={itemVariants}
          className="rounded-2xl p-5"
          style={{ border: "1.5px solid #C4B5FD", background: "#F5F3FF" }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-violet-800">선택된 이력서</p>
            {selectedResume && (
              <button
                onClick={() => setSelectedResumeId(null)}
                className="text-xs text-violet-600 font-semibold hover:underline"
              >
                이력서 변경
              </button>
            )}
          </div>
          {selectedResume ? (
            <p className="text-sm text-gray-700 leading-[1.6]">{selectedResume.fileName}</p>
          ) : resumes.length === 0 ? (
            <p className="text-sm text-gray-400">이력서를 먼저 업로드해주세요.</p>
          ) : (
            <div className="space-y-2">
              {resumes.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedResumeId(r.id)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-white/80 text-sm text-gray-700 hover:bg-white border border-violet-200 transition-all font-medium"
                >
                  {r.fileName}
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* 시작 버튼 */}
        <motion.div variants={itemVariants}>
          {startError && (
            <p className="text-sm text-red-500 mb-3 text-center">{startError}</p>
          )}
          <button
            onClick={handleStart}
            disabled={!selectedResumeId || starting}
            className="w-full flex items-center justify-center gap-2 text-white rounded-full py-3.5 font-semibold text-base shadow-[0_4px_14px_rgba(124,58,237,0.35)] hover:-translate-y-px active:scale-[0.96] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
          >
            {starting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                시작 중...
              </>
            ) : !selectedResumeId ? (
              "이력서를 선택해주세요"
            ) : (
              "면접 시작하기 →"
            )}
          </button>
        </motion.div>
      </motion.div>
    </div>
  )
}
