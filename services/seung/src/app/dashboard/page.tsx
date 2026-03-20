'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DashboardResumeItem, DashboardResponse } from '@/lib/types'

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">대시보드를 불러오는 중...</p>
    </div>
  )
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <p className="text-gray-500">아직 업로드한 자소서가 없습니다.</p>
      <button
        onClick={onStart}
        className="rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-700"
      >
        새 면접 시작
      </button>
    </div>
  )
}

function ResumeCard({ item, onDelete }: { item: DashboardResumeItem; onDelete: (id: string) => void }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const date = new Date(item.createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const handleDelete = async () => {
    if (!window.confirm('이 자소서와 모든 면접 기록(세션, 리포트)을 삭제하시겠습니까?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/resume/${item.id}`, { method: 'DELETE' })
      if (res.ok) {
        onDelete(item.id)
      } else {
        alert('삭제에 실패했습니다. 다시 시도해 주세요.')
        setDeleting(false)
      }
    } catch {
      alert('삭제에 실패했습니다. 다시 시도해 주세요.')
      setDeleting(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-800">{item.fileName}</p>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs text-gray-300 hover:text-red-400 disabled:opacity-50 transition-colors"
        >
          {deleting ? '삭제 중...' : '삭제'}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-xs text-gray-400">{date}</p>
        <span className="text-xs text-gray-300">·</span>
        <span className="text-xs text-gray-400">면접 {item.sessionCount}회</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {item.hasReport && item.reportId && (
          <button
            onClick={() => router.push(`/report?reportId=${item.reportId}`)}
            className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
          >
            역량 리포트 보기
          </button>
        )}
        {item.hasDiagnosis && (
          <button
            onClick={() => router.push(`/diagnosis?resumeId=${item.id}`)}
            className="rounded-md bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100"
          >
            서류 진단 보기
          </button>
        )}
      </div>
      <div className="pt-1">
        <button
          onClick={() => router.push(`/resume?resumeId=${item.id}`)}
          className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
        >
          이 자소서로 다시 면접하기
        </button>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [resumes, setResumes] = useState<DashboardResumeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed')
        return r.json() as Promise<DashboardResponse>
      })
      .then((data) => setResumes(data.resumes))
      .catch(() => setError('데이터를 불러오는 중 오류가 발생했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  const handleStart = () => router.push('/resume')
  const handleDelete = (id: string) => setResumes((prev) => prev.filter((r) => r.id !== id))

  if (loading) return <LoadingScreen />

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white pl-6 pr-28 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">MirAI — 내 면접 기록</h1>
        <button
          onClick={handleStart}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          새 면접 시작
        </button>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        {error && (
          <p className="text-sm text-red-600 text-center py-8" role="alert">
            {error}
          </p>
        )}
        {!error && resumes.length === 0 && <EmptyState onStart={handleStart} />}
        {!error && resumes.length > 0 && (
          <div className="space-y-4">
            {resumes.map((item) => (
              <ResumeCard key={item.id} item={item} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
