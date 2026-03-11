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

  const handleStartInterview = async () => {
    if (!result?.resumeId) return
    setStartingInterview(true)

    try {
      const response = await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: result.resumeId }),
      })

      const data = await response.json()

      if (response.ok && data.sessionId) {
        router.push(`/interview?sessionId=${data.sessionId}`)
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
                  <button
                    onClick={handleStartInterview}
                    disabled={startingInterview}
                    className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                  >
                    {startingInterview ? '면접 준비 중...' : '면접 시작'}
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </main>
    </div>
  )
}
