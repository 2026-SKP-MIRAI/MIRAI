'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import UploadForm from '@/components/UploadForm'
import QuestionList from '@/components/QuestionList'
import type { UploadState, QuestionsResponse } from '@/lib/types'
import { ERROR_MESSAGES, DEFAULT_ERROR_MESSAGE } from '@/lib/types'

export default function ResumePage() {
  const router = useRouter()
  const [state, setState] = useState<UploadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [result, setResult] = useState<QuestionsResponse | null>(null)
  const [startingInterview, setStartingInterview] = useState(false)
  const [showModeSelect, setShowModeSelect] = useState(false)
  const [selectedMode, setSelectedMode] = useState<'real' | 'practice' | null>(null)

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
        // 엔진이 내려준 메시지(detail/error) 우선 — 5MB 초과 등 구체 메시지가 그대로 노출됨
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
              <QuestionList questions={result.questions} onReset={handleReset} />
              {result.resumeId && (
                <div className="mt-6 text-center">
                  {errorMessage && (
                    <p className="mb-3 text-sm text-red-600" role="alert">{errorMessage}</p>
                  )}
                  {!showModeSelect ? (
                    <button
                      onClick={() => setShowModeSelect(true)}
                      disabled={startingInterview}
                      className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                    >
                      면접 시작
                    </button>
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-left">
                      <p className="mb-4 text-sm font-semibold text-gray-700 text-center">면접 모드를 선택해주세요</p>
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
                </div>
              )}
            </div>
          )
        )}
      </main>
    </div>
  )
}
