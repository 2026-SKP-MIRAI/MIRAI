'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'


export default function ContributePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [jobRole, setJobRole] = useState('')
  const [company, setCompany] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetch('/api/resume/submit-accepted')
      .then((r) => r.json())
      .then((data) => setTotalCount(data.count ?? null))
      .catch(() => null)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (selected.type !== 'application/pdf') {
      setError('PDF 파일만 업로드 가능합니다.')
      return
    }
    setError('')
    setFile(selected)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!jobRole) { setError('직군을 선택해주세요.'); return }
    if (!file) { setError('PDF 파일을 업로드해주세요.'); return }
    if (!consent) { setError('동의가 필요합니다.'); return }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('jobRole', jobRole)
      formData.append('company', company)
      formData.append('consent', 'true')

      const res = await fetch('/api/resume/submit-accepted', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '제출에 실패했습니다.')
        return
      }
      setSubmitted(true)
      setTotalCount((prev) => (prev !== null ? prev + 1 : null))
    } catch {
      setError('제출에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-[57px] z-40 border-b border-gray-100 bg-white/95 backdrop-blur-sm px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ← 대시보드
          </button>
          <span className="text-sm font-semibold text-gray-500">합격 자소서 기여</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 mb-4 uppercase tracking-widest">
              Community
            </div>
            <h2 className="text-2xl font-bold text-[#1a1a2e]">합격 자소서 기여하기</h2>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              내 합격 자소서를 공유해 다른 지원자의 서류 진단 품질 향상에 기여합니다.
            </p>
            {totalCount !== null && (
              <p className="mt-2 text-xs text-[#4361ee] font-medium">
                현재까지 {totalCount.toLocaleString()}건의 합격 자소서가 기여되었습니다
              </p>
            )}
          </div>

          {submitted ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
              <div className="text-3xl mb-3">🎉</div>
              <p className="text-base font-bold text-green-800 mb-1">감사합니다!</p>
              <p className="text-sm text-green-700 leading-relaxed">
                내 자소서가 다른 지원자의 서류 진단 품질 향상에 기여합니다.
              </p>
              <button
                onClick={() => router.push('/dashboard')}
                className="mt-5 rounded-xl bg-[#4361ee] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#3a56d4] transition-colors"
              >
                대시보드로 돌아가기
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 직군 입력 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  직군 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={jobRole}
                  onChange={(e) => setJobRole(e.target.value)}
                  placeholder="예: 백엔드 개발자, PM, 데이터 분석가"
                  disabled={submitting}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4361ee] focus:border-[#4361ee] disabled:opacity-50"
                />
              </div>

              {/* 회사명 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  회사명 <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="예: 카카오, 네이버, 토스"
                  disabled={submitting}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4361ee] focus:border-[#4361ee] disabled:opacity-50"
                />
              </div>

              {/* PDF 업로드 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  합격 자소서 PDF <span className="text-red-500">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  disabled={submitting}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting}
                  className={`w-full rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors disabled:opacity-50 ${
                    file
                      ? 'border-[#4361ee] bg-blue-50'
                      : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {file ? (
                    <div>
                      <p className="text-sm font-semibold text-[#4361ee]">📄 {file.name}</p>
                      <p className="mt-1 text-xs text-gray-500">클릭하여 다른 파일로 변경</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-600">클릭하여 PDF 업로드</p>
                      <p className="mt-1 text-xs text-gray-400">합격한 자소서 PDF 파일 (5MB 이하)</p>
                    </div>
                  )}
                </button>
              </div>

              {/* 동의 */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    disabled={submitting}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#4361ee] focus:ring-[#4361ee] disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-600 leading-relaxed">
                    제출한 자소서는 서류 진단 품질 향상을 위해 <strong>익명으로</strong> 활용됩니다.
                    개인 식별 정보가 포함되지 않도록 유의해 주세요. 동의합니다.
                  </span>
                </label>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#4361ee] px-4 py-3 text-sm font-bold text-white hover:bg-[#3a56d4] disabled:opacity-40 transition-colors"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    PDF 분석 중...
                  </span>
                ) : '자소서 제출하기 →'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
