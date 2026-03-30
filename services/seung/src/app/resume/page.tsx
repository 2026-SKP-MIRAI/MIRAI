'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import UploadForm from '@/components/UploadForm'
import Spinner from '@/components/Spinner'
import QuestionList from '@/components/QuestionList'
import type { UploadState, QuestionsResponse } from '@/lib/types'
import { ERROR_MESSAGES, DEFAULT_ERROR_MESSAGE } from '@/lib/types'

type NextAction = null | 'interview' | 'diagnosis'

function ResumeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<UploadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [result, setResult] = useState<QuestionsResponse | null>(null)

  // 면접 시작
  const [selectedAction, setSelectedAction] = useState<NextAction>(null)
  const [startingInterview, setStartingInterview] = useState(false)
  const [selectedMode, setSelectedMode] = useState<'real' | 'practice' | null>(null)

  // 서류 진단
  const [targetRole, setTargetRole] = useState('')
  const [isDiagnosing, setIsDiagnosing] = useState(false)
  const [diagnosisError, setDiagnosisError] = useState('')

  // 대시보드에서 resumeId를 갖고 온 경우 업로드 스킵 → 바로 면접 모드 선택
  useEffect(() => {
    const rid = searchParams.get('resumeId')
    if (rid) {
      setResult({ resumeId: rid, questions: [], meta: { extractedLength: 0, categoriesUsed: [] } })
      setState('done')
    }
  }, [searchParams])

  const handleSubmit = async (file: File) => {
    setState('uploading')
    setErrorMessage('')
    await new Promise((r) => setTimeout(r, 0))

    setState('processing')
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/resume/questions', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        const serverMsg =
          data && typeof data === 'object' && (data.error ?? data.detail)
        const msg =
          (typeof serverMsg === 'string' ? serverMsg : null) ??
          ERROR_MESSAGES[response.status] ??
          DEFAULT_ERROR_MESSAGE
        setErrorMessage(msg)
        setState('error')
        return
      }

      setResult(data)
      setState('done')
    } catch {
      setErrorMessage(DEFAULT_ERROR_MESSAGE)
      setState('error')
    }
  }

  const handleReset = () => {
    setState('idle')
    setErrorMessage('')
    setResult(null)
    setSelectedAction(null)
    setSelectedMode(null)
    setTargetRole('')
    setDiagnosisError('')
  }

  const handleStartInterview = async (interviewMode: 'real' | 'practice') => {
    if (!result?.resumeId) return
    setStartingInterview(true)

    try {
      const response = await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: result.resumeId, interviewMode, ...(targetRole?.trim() ? { targetRole: targetRole.trim() } : {}) }),
      })

      const data = await response.json()

      if (response.ok && data.sessionId) {
        router.push(`/interview?sessionId=${data.sessionId}&interviewMode=${interviewMode}`)
      } else {
        setErrorMessage(data.error ?? '면접 세션을 시작할 수 없습니다.')
        setStartingInterview(false)
      }
    } catch {
      setErrorMessage('면접 세션을 시작할 수 없습니다.')
      setStartingInterview(false)
    }
  }

  const handleDiagnosis = async () => {
    if (!result?.resumeId || !targetRole.trim()) return
    setIsDiagnosing(true)
    setDiagnosisError('')
    try {
      const res = await fetch('/api/resume/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: result.resumeId, targetRole: targetRole.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        setDiagnosisError(data.error ?? '진단에 실패했습니다.')
        return
      }
      router.push(`/diagnosis?resumeId=${result.resumeId}`)
    } catch {
      setDiagnosisError('진단에 실패했습니다.')
    } finally {
      setIsDiagnosing(false)
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
          <span className="text-sm font-semibold text-gray-500">자소서 분석</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
        {state !== 'done' ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#4361ee] mb-4 uppercase tracking-widest">
                Step 1
              </div>
              <h2 className="text-2xl font-bold text-[#1a1a2e]">자소서 업로드</h2>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                PDF 자소서를 업로드하면 AI가 내용을 분석해 예상 면접 질문을 생성합니다.
              </p>
            </div>
            <UploadForm
              state={state}
              errorMessage={errorMessage}
              onSubmit={handleSubmit}
            />
          </div>
        ) : (
          result && (
            <div className="space-y-6">
              {result.questions.length > 0 && (
                <QuestionList questions={result.questions} onReset={handleReset} />
              )}

              {result.resumeId && (
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#4361ee] mb-4 uppercase tracking-widest">
                    Step 2
                  </div>
                  <h2 className="text-lg font-bold text-[#1a1a2e] mb-4">다음 단계를 선택하세요</h2>

                  {/* 액션 선택 카드 */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSelectedAction(selectedAction === 'interview' ? null : 'interview')}
                      disabled={startingInterview || isDiagnosing}
                      className={`rounded-xl border p-4 text-left transition-all disabled:opacity-50 hover:shadow-md ${
                        selectedAction === 'interview'
                          ? 'border-[#1a1a2e] bg-[#1a1a2e] text-white'
                          : 'border-gray-200 bg-white hover:border-gray-400'
                      }`}
                    >
                      <div className="text-xl mb-2">🎤</div>
                      <p className="font-bold text-sm">면접 시작하기</p>
                      <p className={`mt-1 text-xs leading-relaxed ${selectedAction === 'interview' ? 'text-gray-300' : 'text-gray-500'}`}>
                        AI 패널 면접 시뮬레이션
                      </p>
                    </button>
                    <button
                      onClick={() => setSelectedAction(selectedAction === 'diagnosis' ? null : 'diagnosis')}
                      disabled={startingInterview || isDiagnosing}
                      className={`rounded-xl border p-4 text-left transition-all disabled:opacity-50 hover:shadow-md ${
                        selectedAction === 'diagnosis'
                          ? 'border-[#4361ee] bg-[#4361ee] text-white'
                          : 'border-blue-200 bg-blue-50 hover:border-blue-400'
                      }`}
                    >
                      <div className="text-xl mb-2">📋</div>
                      <p className="font-bold text-sm">서류 진단</p>
                      <p className={`mt-1 text-xs leading-relaxed ${selectedAction === 'diagnosis' ? 'text-blue-100' : 'text-blue-600'}`}>
                        5개 항목 강점·약점 분석
                      </p>
                    </button>
                  </div>

                  {/* 면접 시작 세부 UI */}
                  {selectedAction === 'interview' && (
                    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-5">
                      {errorMessage && (
                        <p className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700" role="alert">{errorMessage}</p>
                      )}
                      <p className="mb-3 text-sm font-semibold text-gray-700">면접 모드를 선택해주세요</p>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setSelectedMode('real')}
                          disabled={startingInterview}
                          className={`rounded-lg border p-4 text-left transition-all disabled:opacity-50 ${
                            selectedMode === 'real'
                              ? 'border-[#1a1a2e] bg-[#1a1a2e] text-white'
                              : 'border-gray-200 bg-white hover:border-gray-400'
                          }`}
                        >
                          <p className="font-bold text-sm">실전 모드</p>
                          <p className={`mt-1 text-xs leading-relaxed ${selectedMode === 'real' ? 'text-gray-300' : 'text-gray-500'}`}>
                            답변 후 다음 질문으로 이동
                          </p>
                        </button>
                        <button
                          onClick={() => setSelectedMode('practice')}
                          disabled={startingInterview}
                          className={`rounded-lg border p-4 text-left transition-all disabled:opacity-50 ${
                            selectedMode === 'practice'
                              ? 'border-[#4361ee] bg-[#4361ee] text-white'
                              : 'border-blue-100 bg-white hover:border-blue-300'
                          }`}
                        >
                          <p className="font-bold text-sm">연습 모드</p>
                          <p className={`mt-1 text-xs leading-relaxed ${selectedMode === 'practice' ? 'text-blue-100' : 'text-blue-600'}`}>
                            즉각 피드백 + 재답변 가능
                          </p>
                        </button>
                      </div>
                      <button
                        onClick={() => selectedMode && handleStartInterview(selectedMode)}
                        disabled={!selectedMode || startingInterview}
                        className="mt-4 w-full rounded-xl bg-[#4361ee] px-4 py-3 text-sm font-bold text-white hover:bg-[#3a56d4] disabled:opacity-40 transition-colors"
                      >
                        {startingInterview ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            면접 준비 중...
                          </span>
                        ) : '면접 시작하기 →'}
                      </button>
                    </div>
                  )}

                  {/* 서류 진단 세부 UI */}
                  {selectedAction === 'diagnosis' && (
                    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-5">
                      <p className="mb-3 text-sm font-semibold text-gray-700">지원 직무를 입력하세요</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={targetRole}
                          onChange={(e) => setTargetRole(e.target.value)}
                          placeholder="예: 백엔드 개발자"
                          disabled={isDiagnosing}
                          onKeyDown={(e) => e.key === 'Enter' && handleDiagnosis()}
                          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4361ee] focus:border-[#4361ee] disabled:opacity-50"
                        />
                        <button
                          onClick={handleDiagnosis}
                          disabled={!targetRole.trim() || isDiagnosing}
                          className="rounded-lg bg-[#4361ee] px-4 py-2 text-sm font-bold text-white hover:bg-[#3a56d4] disabled:opacity-40 transition-colors"
                        >
                          {isDiagnosing ? '진단 중...' : '진단하기'}
                        </button>
                      </div>
                      {diagnosisError && (
                        <p className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700" role="alert">{diagnosisError}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        )}
      </main>
    </div>
  )
}

export default function ResumePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-4">
          <Spinner />
          <p className="text-sm text-gray-500">불러오는 중...</p>
        </div>
      }
    >
      <ResumeContent />
    </Suspense>
  )
}
