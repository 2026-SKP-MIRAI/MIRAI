'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DashboardResumeItem, DashboardResponse, UserProgressItem, UserProgressResponse } from '@/lib/types'
import Spinner from '@/components/Spinner'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Spinner />
      <p className="text-sm text-gray-500">대시보드를 불러오는 중...</p>
    </div>
  )
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-5">
        <svg className="w-8 h-8 text-[#4361ee]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-1.5">아직 자소서가 없습니다</h3>
      <p className="text-sm text-gray-500 mb-7 max-w-xs leading-relaxed">
        자소서를 업로드하면 AI 면접관 3인이 맞춤 질문을 만들어드립니다.
      </p>
      <button
        onClick={onStart}
        className="rounded-xl bg-[#4361ee] px-7 py-3 text-sm font-bold text-white hover:bg-[#3a56d4] transition-colors shadow-lg shadow-[#4361ee]/25"
      >
        자소서 업로드하기 →
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
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* 파일명 + 메타 + 삭제 */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4.5 h-4.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-snug break-all">{item.fileName}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs text-gray-400">{date}</span>
              <span className="text-gray-300 text-xs">·</span>
              <span className="text-xs text-gray-400">면접 {item.sessionCount}회</span>
              {item.latestScore !== undefined && (
                <>
                  <span className="text-gray-300 text-xs">·</span>
                  <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${
                    item.latestScore >= 80
                      ? 'text-emerald-600 bg-emerald-50'
                      : item.latestScore >= 60
                        ? 'text-amber-600 bg-amber-50'
                        : 'text-red-600 bg-red-50'
                  }`}>
                    {item.latestScore}점
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs text-gray-300 hover:text-red-400 disabled:opacity-50 transition-colors shrink-0 pt-0.5"
        >
          {deleting ? '삭제 중...' : '삭제'}
        </button>
      </div>

      {/* 액션 버튼 */}
      <div className="flex flex-wrap items-center gap-2">
        {item.inProgressSessionId && (
          <button
            onClick={() => router.push(`/interview?sessionId=${item.inProgressSessionId}`)}
            className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-400 transition-colors"
          >
            이어하기
          </button>
        )}
        {item.reports.map((r, i) => (
          <button
            key={r.id}
            onClick={() => router.push(`/report?reportId=${r.id}`)}
            className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
          >
            역량 리포트{item.reports.length > 1 ? ` #${i + 1}` : ''}
          </button>
        ))}
        {item.hasDiagnosis && (
          <button
            onClick={() => router.push(`/diagnosis?resumeId=${item.id}`)}
            className="rounded-lg bg-orange-50 border border-orange-200 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 transition-colors"
          >
            서류 진단
          </button>
        )}
        <button
          onClick={() => router.push(`/resume?resumeId=${item.id}`)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors ml-auto"
        >
          다시 면접하기
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
  const [progressItems, setProgressItems] = useState<UserProgressItem[]>([])

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

  useEffect(() => {
    fetch('/api/user/progress')
      .then((r) => {
        if (!r.ok) return
        return r.json() as Promise<UserProgressResponse>
      })
      .then((data) => {
        if (data) setProgressItems(data.items)
      })
      .catch(() => {/* progress는 부가 기능 — 오류 무시 */})
  }, [])

  const handleStart = () => router.push('/resume')
  const handleDelete = (id: string) => setResumes((prev) => prev.filter((r) => r.id !== id))

  if (loading) return <LoadingScreen />

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-[57px] z-40 border-b border-gray-100 bg-white/95 backdrop-blur-sm px-4 sm:px-6 py-4 flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-900">내 면접 기록</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/contribute')}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            합격 자소서 기여
          </button>
          <button
            onClick={handleStart}
            className="rounded-lg bg-[#4361ee] px-4 py-2 text-sm font-bold text-white hover:bg-[#3a56d4] transition-colors"
          >
            + 자소서 업로드
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 text-center" role="alert">
            {error}
          </div>
        )}
        {!error && resumes.length === 0 && <EmptyState onStart={handleStart} />}
        {!error && progressItems.length >= 2 && (
          <div className="mb-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">성장 추이</p>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={progressItems} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="round"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickFormatter={(v) => `${v}회`}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}점`, '종합 점수']}
                    labelFormatter={(label) => `${label}회차`}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalScore"
                    stroke="#4361ee"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#4361ee', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {!error && resumes.length > 0 && (
          <>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">내 자소서</p>
            <div className="space-y-4">
              {resumes.map((item) => (
                <ResumeCard key={item.id} item={item} onDelete={handleDelete} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
