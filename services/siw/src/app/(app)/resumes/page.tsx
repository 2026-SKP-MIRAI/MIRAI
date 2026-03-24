"use client"
import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { FileText, Plus } from "lucide-react"
import { motion } from "framer-motion"
import UploadForm from "@/components/UploadForm"
import type { QuestionsResponse } from "@/lib/types"

type ResumeItem = {
  id: string
  fileName: string
  uploadedAt: string
  questionCount: number
  categories: string[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.065 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: "easeOut" as const } },
}

export default function ResumesPage() {
  const router = useRouter()
  const [resumes, setResumes] = useState<ResumeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    fetch("/api/resumes")
      .then(r => r.json())
      .then(data => { setResumes(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">내 이력서</h1>
        <p className="text-sm text-gray-500 mt-1">업로드된 이력서를 관리하세요</p>
      </div>

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-40 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      )}

      {/* 이력서 목록 */}
      {!loading && resumes.length > 0 && (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4">
          {resumes.map(resume => (
            <motion.div
              key={resume.id}
              variants={itemVariants}
              className="bg-white/90 backdrop-blur-sm border border-black/[0.08] rounded-2xl p-6 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] transition-all duration-200"
            >
              <div className="flex gap-4 items-start">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, #EDE9FE, #DDD6FE)" }}
                >
                  <FileText className="w-6 h-6 text-violet-600" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-gray-900">{resume.fileName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(resume.uploadedAt)}</p>
                    </div>
                    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 shrink-0">
                      활성
                    </span>
                  </div>

                  <div className="mt-3 bg-gray-50 rounded-lg px-3 py-2.5 text-xs text-gray-500 border border-black/[0.05] truncate">
                    {resume.fileName}
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Link
                      href={`/resumes/${resume.id}`}
                      className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95"
                    >
                      내용 보기 →
                    </Link>
                    <Link
                      href={`/interview/new?resumeId=${resume.id}`}
                      className="flex items-center gap-1.5 text-white rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 shadow-sm"
                      style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
                    >
                      이 이력서로 면접
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {/* 추가 업로드 카드 */}
          <motion.div variants={itemVariants}>
            {showUpload ? (
              <div className="bg-white/90 backdrop-blur-sm border border-black/[0.08] rounded-2xl p-6">
                <UploadForm hideTitle onComplete={(data: QuestionsResponse) => { router.push(`/resumes/${data.resumeId}`) }} />
              </div>
            ) : (
              <button
                onClick={() => setShowUpload(true)}
                className="w-full border-2 border-dashed border-gray-200 bg-transparent rounded-2xl py-10 text-center hover:border-violet-300 hover:bg-violet-50/30 transition-all duration-200 group"
              >
                <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-violet-100 flex items-center justify-center mx-auto mb-3 transition-colors">
                  <Plus className="w-6 h-6 text-gray-400 group-hover:text-violet-600 transition-colors" />
                </div>
                <p className="font-semibold text-gray-700 mb-1">새 이력서 추가</p>
                <p className="text-sm text-gray-400">이력서를 업로드하면 AI가 자동으로 분석해드려요</p>
              </button>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* 빈 상태 */}
      {!loading && resumes.length === 0 && (
        showUpload ? (
          <div className="bg-white/90 backdrop-blur-sm border border-black/[0.08] rounded-2xl p-8">
            <UploadForm hideTitle onComplete={(data: QuestionsResponse) => { router.push(`/resumes/${data.resumeId}`) }} />
          </div>
        ) : (
          <div className="bg-white/90 backdrop-blur-sm border border-black/[0.08] rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">아직 업로드한 이력서가 없습니다</h3>
            <p className="text-sm text-gray-400 mb-6">이력서를 업로드하면 AI가 면접 질문을 생성해드립니다</p>
            <button
              onClick={() => setShowUpload(true)}
              className="text-white rounded-full px-6 py-3 font-semibold shadow-[0_4px_14px_rgba(124,58,237,0.35)] active:scale-95 transition-all"
              style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
            >
              첫 이력서 업로드
            </button>
          </div>
        )
      )}
    </div>
  )
}
