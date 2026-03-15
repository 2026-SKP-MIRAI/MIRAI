"use client"
import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import { ChevronLeft } from "lucide-react"

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
  resumeText?: string
  questionCount: number
  categories: string[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
}

export default function ResumeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [resume, setResume] = useState<ResumeItem | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/resumes/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: ResumeItem | null) => {
        setResume(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

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
        <div className="flex gap-2">
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
        {/* 이력서 원문 */}
        <motion.div
          variants={itemVariants}
          className="bg-white/90 backdrop-blur-sm border border-black/[0.08] rounded-2xl p-6 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] transition-all duration-200"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">이력서 원문</h2>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-600">원문</span>
          </div>
          <div className="bg-gray-50 rounded-xl px-5 py-4 text-sm leading-[1.9] text-gray-700 whitespace-pre-wrap font-mono border border-black/[0.05]">
            {resume.resumeText ?? resume.fileName}
          </div>
        </motion.div>

        {/* 8축 역량 평가 - mock */}
        <motion.div
          variants={itemVariants}
          className="bg-white/90 backdrop-blur-sm border border-black/[0.08] rounded-2xl p-6 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] transition-all duration-200"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">8축 역량 평가</h2>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-500">준비 중</span>
          </div>
          <div className="bg-gray-50 rounded-xl p-5 text-center border border-black/[0.05]">
            <p className="text-sm text-gray-400">면접 기록 연동은 로그인 기능 구현 후 제공될 예정입니다.</p>
          </div>
        </motion.div>

        {/* 성장 요약 - mock */}
        <motion.div
          variants={itemVariants}
          className="bg-white/90 backdrop-blur-sm border border-black/[0.08] rounded-2xl p-6 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] transition-all duration-200"
        >
          <h2 className="text-lg font-bold text-gray-900 mb-4">성장 요약</h2>
          <div className="bg-gray-50 rounded-xl p-5 text-center border border-black/[0.05]">
            <p className="text-sm text-gray-400">로그인 기능 구현 후 이 이력서로 진행한 면접 기록이 연동됩니다.</p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
