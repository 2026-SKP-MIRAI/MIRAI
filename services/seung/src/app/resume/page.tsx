'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import UploadForm from '@/components/UploadForm'
import QuestionList from '@/components/QuestionList'
import type { UploadState, QuestionsResponse } from '@/lib/types'
import { ERROR_MESSAGES, DEFAULT_ERROR_MESSAGE } from '@/lib/types'

type NextAction = null | 'interview' | 'diagnosis'

export default function ResumePage() {
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
      // questions/meta는 업로드 없이 재사용하므로 더미값 — QuestionList는 questions.length > 0일 때만 렌더링
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
        body: JSON.stringify({ resumeId: result.resumeId, interviewMode }),
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
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-lg font-bold text-gray-900">MirAI — 면접 질문 생성</h1>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        {state !== 'done' ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900">자소서 분석</h2>
              <p className="mt-2 text-sm text-gray-500">
                PDF 자소서를 업로드하면 예상 면접 질문을 카테고리별로 생성합니다.
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
            <div>
              {result.questions.length > 0 && (
                <QuestionList questions={result.questions} onReset={handleReset} />
              )}

              {result.resumeId && (
                <div className="mt-6">
                  <p className="text-sm font-semibold text-gray-700 mb-3 text-center">다음 단계를 선택하세요</p>

                  {/* 액션 선택 카드 */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setSelectedAction(selectedAction === 'interview' ? null : 'interview')}
                      disabled={startingInterview || isDiagnosing}
                      className={`flex-1 rounded-xl border px-4 py-4 text-left transition-colors disabled:opacity-50 ${
                        selectedAction === 'interview'
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white hover:border-gray-400'
                      }`}
                    >
                      <p className="font-semibold text-sm">🎤 면접 시작하기</p>
                      <p className={`mt-1 text-xs ${selectedAction === 'interview' ? 'text-gray-300' : 'text-gray-500'}`}>
                        AI 패널 면접 시뮬레이션
                      </p>
                    </button>
                    <button
                      onClick={() => setSelectedAction(selectedAction === 'diagnosis' ? null : 'diagnosis')}
                      disabled={startingInterview || isDiagnosing}
                      className={`flex-1 rounded-xl border px-4 py-4 text-left transition-colors disabled:opacity-50 ${
                        selectedAction === 'diagnosis'
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-blue-200 bg-blue-50 hover:border-blue-400'
                      }`}
                    >
                      <p className="font-semibold text-sm">📋 서류 진단받기</p>
                      <p className={`mt-1 text-xs ${selectedAction === 'diagnosis' ? 'text-blue-100' : 'text-blue-600'}`}>
                        5개 항목 강점·약점 분석
                      </p>
                    </button>
                  </div>

                  {/* 면접 시작 세부 UI */}
                  {selectedAction === 'interview' && (
                    <div className="mt-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                      {errorMessage && (
                        <p className="mb-3 text-sm text-red-600" role="alert">{errorMessage}</p>
                      )}
                      <p className="mb-3 text-sm font-semibold text-gray-700">면접 모드를 선택해주세요</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setSelectedMode('real')}
                          disabled={startingInterview}
                          className={`flex-1 rounded-lg border px-4 py-4 text-left transition-colors disabled:opacity-50 ${
                            selectedMode === 'real'
                              ? 'border-gray-900 bg-gray-900 text-white'
                              : 'border-gray-200 bg-white hover:border-gray-400'
                          }`}
                        >
                          <p className="font-semibold text-sm">실전 모드</p>
                          <p className={`mt-1 text-xs ${selectedMode === 'real' ? 'text-gray-300' : 'text-gray-500'}`}>
                            답변 제출 후 다음 질문으로 이동
                          </p>
                        </button>
                        <button
                          onClick={() => setSelectedMode('practice')}
                          disabled={startingInterview}
                          className={`flex-1 rounded-lg border px-4 py-4 text-left transition-colors disabled:opacity-50 ${
                            selectedMode === 'practice'
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-blue-200 bg-blue-50 hover:border-blue-400'
                          }`}
                        >
                          <p className="font-semibold text-sm">연습 모드</p>
                          <p className={`mt-1 text-xs ${selectedMode === 'practice' ? 'text-blue-100' : 'text-blue-600'}`}>
                            즉각 피드백 + 재답변 가능
                          </p>
                        </button>
                      </div>
                      <button
                        onClick={() => selectedMode && handleStartInterview(selectedMode)}
                        disabled={!selectedMode || startingInterview}
                        className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
                      >
                        {startingInterview ? '면접 준비 중...' : '확인'}
                      </button>
                    </div>
                  )}

                  {/* 서류 진단 세부 UI */}
                  {selectedAction === 'diagnosis' && (
                    <div className="mt-3 rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
                      <p className="mb-3 text-sm font-semibold text-gray-700">지원 직무를 입력하세요</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={targetRole}
                          onChange={(e) => setTargetRole(e.target.value)}
                          placeholder="예: 백엔드 개발자"
                          disabled={isDiagnosing}
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                        />
                        <button
                          onClick={handleDiagnosis}
                          disabled={!targetRole.trim() || isDiagnosing}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
                        >
                          {isDiagnosing ? '진단 중...' : '진단하기'}
                        </button>
                      </div>
                      {diagnosisError && (
                        <p className="mt-2 text-sm text-red-600" role="alert">{diagnosisError}</p>
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
