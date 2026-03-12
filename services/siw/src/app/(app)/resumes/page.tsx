"use client"
import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { FileText, Plus } from "lucide-react"

type ResumeItem = {
  id: string
  fileName: string
  uploadedAt: string
  questionCount: number
  categories: string[]
}

const CATEGORY_TAGS: Record<string, string> = {
  "직무 역량": "tag-blue",
  "경험의 구체성": "tag-green",
  "성과 근거": "tag-yellow",
  "기술 역량": "tag-purple",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
}

export default function ResumesPage() {
  const router = useRouter()
  const [resumes, setResumes] = useState<ResumeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/resumes")
      .then(r => r.json())
      .then(data => { setResumes(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleStartInterview(resumeId: string) {
    setStarting(resumeId)
    try {
      const res = await fetch("/api/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, personas: ["hr", "tech_lead", "executive"] }),
      })
      const json = await res.json()
      if (!res.ok) return
      sessionStorage.setItem(`interview-first-${json.sessionId}`, JSON.stringify(json.firstQuestion))
      router.push(`/interview/${json.sessionId}`)
    } finally {
      setStarting(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold gradient-text">내 자소서</h1>
        {!loading && <p className="text-sm text-[#4B5563] mt-1">저장된 자소서 {resumes.length}개</p>}
      </div>

      {loading && (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
      )}

      {!loading && resumes.length === 0 && (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#1F2937] mb-2">아직 업로드한 자소서가 없습니다</h3>
          <p className="text-sm text-[#9CA3AF] mb-6">자소서를 업로드하면 AI가 면접 질문을 생성해드립니다</p>
          <button onClick={() => router.push("/resume")} className="btn-primary rounded-xl px-6 py-3">
            첫 자소서 업로드
          </button>
        </div>
      )}

      {!loading && resumes.length > 0 && (
        <div className="space-y-4">
          {resumes.map(resume => (
            <div key={resume.id} className="glass-card glass-card-hover rounded-2xl p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-[#1F2937]">{resume.fileName}</p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">{formatDate(resume.uploadedAt)}</p>
                </div>
                <span className="tag tag-blue">{resume.questionCount}개 질문</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {resume.categories.map(cat => (
                  <span key={cat} className={`tag ${CATEGORY_TAGS[cat] ?? "tag-blue"}`}>{cat}</span>
                ))}
              </div>
              <button
                onClick={() => handleStartInterview(resume.id)}
                disabled={starting === resume.id}
                className="btn-primary rounded-xl px-4 py-2.5 w-full flex items-center justify-center gap-2 text-sm"
              >
                {starting === resume.id
                  ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />시작 중...</>
                  : "이 자소서로 면접 시작"
                }
              </button>
            </div>
          ))}

          <button
            onClick={() => router.push("/resume")}
            className="btn-outline rounded-xl px-5 py-3 w-full flex items-center justify-center gap-2 border-dashed"
          >
            <Plus className="w-4 h-4" />
            새 자소서 업로드
          </button>
        </div>
      )}
    </div>
  )
}
