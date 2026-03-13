'use client'

import { useState } from 'react'
import UploadForm from '@/components/UploadForm'
import QuestionList from '@/components/QuestionList'
import type { GenerateResult, UploadState } from '@/domain/interview/types'

export default function HomePage() {
  const [state, setState] = useState<UploadState>('idle')
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(file: File) {
    setState('uploading')
    setErrorMsg(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/resume/questions', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? '오류가 발생했습니다. 다시 시도해주세요.')
        setState('error')
        return
      }

      setResult(data as GenerateResult)
      setState('done')
    } catch {
      setErrorMsg('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
      setState('error')
    }
  }

  function handleReset() {
    setState('idle')
    setResult(null)
    setErrorMsg(null)
  }

  const isLoading = state === 'uploading'

  return (
    <main className="min-h-screen bg-white flex flex-col items-center py-16 px-4">
      <div className="w-full max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">자소서 기반 예상 질문 생성</h1>
        <p className="text-sm text-gray-500 mb-8">
          PDF 자소서를 업로드하면 맞춤 면접 질문을 생성해드립니다.
        </p>

        {state === 'done' && result ? (
          <QuestionList
            questions={result.questions}
            resumeId={result.resumeId}
            onReset={handleReset}
          />
        ) : (
          <>
            <UploadForm onSubmit={handleSubmit} isLoading={isLoading} />
            {isLoading && (
              <p className="mt-4 text-sm text-blue-600 animate-pulse">
                자소서를 분석하고 있습니다...
              </p>
            )}
            {state === 'error' && errorMsg && (
              <div className="mt-4 flex flex-col gap-2">
                <p className="text-sm text-red-600" role="alert">
                  {errorMsg}
                </p>
                <button
                  onClick={handleReset}
                  className="text-sm text-gray-500 underline hover:text-gray-700 self-start"
                >
                  다시 시도하기
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
