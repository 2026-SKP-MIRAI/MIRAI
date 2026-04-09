'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DashboardResumeItem, DashboardResponse, UserProgressItem, UserProgressResponse } from '@/domain/interview/types'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4" style={{ background: 'var(--kwan-bg)' }}>
      <div className="skeleton w-10 h-10 rounded-full" />
      <p style={{ fontSize: '0.875rem', color: 'var(--kwan-text-2)' }}>대시보드를 불러오는 중...</p>
    </div>
  )
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="matte-card flex flex-col items-center justify-center py-16 text-center" style={{ gridColumn: '1 / -1' }}>
      <div
        className="flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
        style={{ background: 'var(--kwan-teal-dim)' }}
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--kwan-teal)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--kwan-text)', marginBottom: '0.5rem' }}>아직 자소서가 없습니다</h3>
      <p style={{ fontSize: '0.875rem', color: 'var(--kwan-text-2)', maxWidth: '18rem', lineHeight: 1.65, marginBottom: '1.5rem' }}>
        자소서를 업로드하면 AI 면접관 3인이 맞춤 질문을 만들어드립니다.
      </p>
      <button onClick={onStart} className="btn-primary" style={{ padding: '0.75rem 1.75rem', fontSize: '0.875rem' }}>
        자소서 업로드하기 →
      </button>
    </div>
  )
}

function ResumeCard({ item, onDelete }: { item: DashboardResumeItem; onDelete: (id: string) => void }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const date = new Date(item.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  const handleDelete = async () => {
    if (!window.confirm('이 자소서와 모든 면접 기록(세션, 리포트)을 삭제하시겠습니까?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/resume/${item.id}`, { method: 'DELETE' })
      if (res.ok) onDelete(item.id)
      else { alert('삭제에 실패했습니다.'); setDeleting(false) }
    } catch { alert('삭제에 실패했습니다.'); setDeleting(false) }
  }

  return (
    <div className="matte-card p-5">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex items-start gap-3">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
            style={{ background: 'rgba(248,113,113,0.12)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--kwan-error)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--kwan-text)', wordBreak: 'break-all' }}>{item.fileName}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--kwan-text-muted)', marginTop: '0.2rem' }}>
              {date} · 면접 {item.sessionCount}회
            </p>
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{ fontSize: '0.75rem', color: 'var(--kwan-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem 0.4rem', transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--kwan-error)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--kwan-text-muted)')}
        >
          {deleting ? '삭제 중...' : '삭제'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {item.inProgressSessionId && (
          <button
            onClick={() => router.push(`/interview?sessionId=${item.inProgressSessionId}`)}
            className="tag tag-success"
            style={{ cursor: 'pointer', border: 'none' }}
          >
            이어하기
          </button>
        )}
        {item.reports.map((r, i) => (
          <button
            key={r.id}
            onClick={() => router.push(`/report?reportId=${r.id}`)}
            className="tag tag-teal"
            style={{ cursor: 'pointer', border: 'none' }}
          >
            역량 리포트{item.reports.length > 1 ? ` #${i + 1}` : ''}
          </button>
        ))}
        {item.hasDiagnosis && (
          <button
            onClick={() => router.push(`/diagnosis?resumeId=${item.id}`)}
            className="tag tag-amber"
            style={{ cursor: 'pointer', border: 'none' }}
          >
            서류 진단
          </button>
        )}
        <button
          onClick={() => router.push('/upload')}
          className="tag tag-muted"
          style={{ cursor: 'pointer', border: 'none', marginLeft: 'auto' }}
        >
          새 자소서 업로드
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
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<DashboardResponse> })
      .then(data => setResumes(data.resumes))
      .catch(() => setError('데이터를 불러오는 중 오류가 발생했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/user/progress')
      .then(r => { if (!r.ok) return; return r.json() as Promise<UserProgressResponse> })
      .then(data => { if (data) setProgressItems(data.items) })
      .catch(() => {})
  }, [])

  if (loading) return <LoadingScreen />

  const avgScore = progressItems.length
    ? Math.round(progressItems.reduce((s, i) => s + i.totalScore, 0) / progressItems.length)
    : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--kwan-bg)' }}>
      {/* Sub-header */}
      <header
        className="sticky border-b px-6 py-3 flex items-center justify-between"
        style={{ top: '56px', zIndex: 40, background: 'var(--kwan-surface)', borderColor: 'var(--kwan-border)' }}
      >
        <h1 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--kwan-text)' }}>내 면접 기록</h1>
        <button
          onClick={() => router.push('/upload')}
          className="btn-primary"
          style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
        >
          + 자소서 업로드
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {error && (
          <div className="rounded-xl px-4 py-3 mb-6 text-sm text-center"
            style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: 'var(--kwan-error)' }}
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Bento row 1 — chart + stats */}
        {!error && (progressItems.length >= 2 || resumes.length > 0) && (
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {/* Growth chart */}
            <div className="matte-card p-5 md:col-span-2">
              <p className="section-label mb-4">성장 추이</p>
              {progressItems.length >= 2 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={progressItems} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="round" tick={{ fontSize: 11, fill: '#5A6A7E' }} tickFormatter={v => `${v}회`} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#5A6A7E' }} />
                    <Tooltip
                      formatter={v => [`${v}점`, '종합 점수']}
                      labelFormatter={l => `${l}회차`}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: '#1A2332', color: '#E8ECF1' }}
                    />
                    <Line type="monotone" dataKey="totalScore" stroke="#2DD4BF" strokeWidth={2}
                      dot={{ r: 4, fill: '#2DD4BF', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-44" style={{ color: 'var(--kwan-text-muted)', fontSize: '0.875rem' }}>
                  2회 이상 면접 후 추이가 표시됩니다
                </div>
              )}
            </div>

            {/* Quick stats */}
            <div className="matte-card p-5 flex flex-col gap-3">
              <p className="section-label">빠른 통계</p>
              {[
                { label: '총 이력서', value: resumes.length, color: 'var(--kwan-teal)' },
                { label: '총 면접', value: resumes.reduce((s, r) => s + r.sessionCount, 0), color: 'var(--kwan-text)' },
                { label: '평균 점수', value: avgScore !== null ? `${avgScore}점` : '—', color: 'var(--kwan-amber)' },
              ].map(stat => (
                <div key={stat.label} className="matte-elevated p-3">
                  <p style={{ fontSize: '0.75rem', color: 'var(--kwan-text-muted)', marginBottom: '0.2rem' }}>{stat.label}</p>
                  <p style={{ fontSize: '1.625rem', fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resume grid */}
        {!error && resumes.length === 0 && <EmptyState onStart={() => router.push('/upload')} />}
        {!error && resumes.length > 0 && (
          <>
            <p className="section-label mb-4">내 자소서</p>
            <div className="grid md:grid-cols-2 gap-4">
              {resumes.map(item => (
                <ResumeCard key={item.id} item={item} onDelete={id => setResumes(prev => prev.filter(r => r.id !== id))} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
