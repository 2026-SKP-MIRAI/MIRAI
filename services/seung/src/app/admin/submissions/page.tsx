'use client'

import { useState, useEffect } from 'react'

type Submission = {
  id: number
  userId: string
  jobRole: string
  company: string | null
  processed: boolean
  createdAt: string
}

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'true' | 'false'>('all')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const fetchSubmissions = () => {
    setLoading(true)
    const query = filter !== 'all' ? `?processed=${filter}` : ''
    fetch(`/api/admin/resume-submissions${query}`)
      .then((r) => {
        if (r.status === 401) throw new Error('로그인이 필요합니다.')
        if (r.status === 403) throw new Error('관리자 권한이 없습니다.')
        if (!r.ok) throw new Error('불러오기 실패')
        return r.json()
      })
      .then((data) => setSubmissions(data.submissions))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchSubmissions() }, [filter])

  const handleDelete = async (id: number) => {
    if (!window.confirm(`#${id} 제출을 삭제하시겠습니까?`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/resume-submissions?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('삭제 실패')
      setSubmissions((prev) => prev.filter((s) => s.id !== id))
    } catch {
      alert('삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-[57px] z-40 border-b border-gray-100 bg-white/95 backdrop-blur-sm px-4 sm:px-6 py-4 flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-900">합격 자소서 제출 관리</h1>
        <div className="flex items-center gap-2">
          {(['all', 'false', 'true'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === v
                  ? 'bg-[#4361ee] text-white'
                  : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {v === 'all' ? '전체' : v === 'false' ? '미처리' : '처리됨'}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        {loading ? (
          <p className="text-sm text-gray-500 text-center py-20">불러오는 중...</p>
        ) : error ? (
          <p className="text-sm text-red-600 text-center py-20">{error}</p>
        ) : submissions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-20">제출 내역이 없습니다.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-gray-400 font-medium">총 {submissions.length}건</p>
            {submissions.map((s) => (
              <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-xs font-bold text-gray-400">#{s.id}</span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{s.jobRole}</span>
                      {s.company && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{s.company}</span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.processed ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                        {s.processed ? '처리됨' : '미처리'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">
                      userId: {s.userId} · {new Date(s.createdAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={deletingId === s.id}
                    className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                  >
                    {deletingId === s.id ? '삭제 중...' : '삭제'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
