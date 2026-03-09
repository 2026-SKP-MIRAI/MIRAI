'use client'

import { useState } from 'react'
import UploadForm from '@/components/UploadForm'
import QuestionList from '@/components/QuestionList'
import type { UploadState, QuestionsResponse } from '@/lib/types'
import { ERROR_MESSAGES, DEFAULT_ERROR_MESSAGE } from '@/lib/types'

export default function Home() {
  const [state, setState] = useState<UploadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [result, setResult] = useState<QuestionsResponse | null>(null)

  const handleSubmit = async (file: File) => {
    setState('uploading')
    setErrorMessage('')

    const formData = new FormData()
    formData.append('file', file)

    setState('processing')

    try {
      const response = await fetch('/api/resume/questions', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        const msg = ERROR_MESSAGES[response.status] ?? DEFAULT_ERROR_MESSAGE
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
          result && <QuestionList questions={result.questions} onReset={handleReset} />
        )}
      </main>
    </div>
  )
}
