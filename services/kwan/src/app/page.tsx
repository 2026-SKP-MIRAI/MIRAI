'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import UploadForm from '@/components/UploadForm'
import type { GenerateResult, UploadState } from '@/domain/interview/types'

export default function HomePage() {
  const router = useRouter()
  const [state, setState] = useState<UploadState>('idle')
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [targetRole, setTargetRole] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  // Step 1: PDF 업로드 → 질문 생성 + targetRole 추출
  async function handleSubmit(file: File) {
    setState('uploading')
    setErrorMsg(null)
    setResult(null)
    setPendingFile(file)

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

      const generated = data as GenerateResult
      setResult(generated)
      setTargetRole(generated.inferredTargetRole ?? '')
      setState('confirming')
    } catch {
      setErrorMsg('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
      setState('error')
    }
  }

  // Step 2: targetRole 확정 → 자소서 진단 → /diagnosis 이동
  async function handleConfirm() {
    if (!result?.resumeId) return
    setState('processing')
    setErrorMsg(null)

    // 백그라운드: 사용자 확정 targetRole로 questions 재생성 (fire-and-forget)
    if (pendingFile && targetRole.trim() && result.resumeId) {
      const bgForm = new FormData()
      bgForm.append('file', pendingFile)
      bgForm.append('targetRole', targetRole.trim())
      bgForm.append('resumeId', result.resumeId) // 기존 row 업데이트 (새 row 생성 방지)
      void fetch('/api/resume/questions', { method: 'POST', body: bgForm }).catch(() => {})
    }

    try {
      const res = await fetch('/api/resume/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: result.resumeId, targetRole: targetRole.trim() || undefined }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? '진단 중 오류가 발생했습니다.')
        setState('confirming')
        return
      }

      router.push(`/diagnosis?resumeId=${result.resumeId}`)
    } catch {
      setErrorMsg('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
      setState('confirming')
    }
  }

  function handleReset() {
    setState('idle')
    setResult(null)
    setTargetRole('')
    setErrorMsg(null)
  }

  const isUploading = state === 'uploading'
  const isProcessing = state === 'processing'

  return (
    <main className="min-h-screen bg-white flex flex-col items-center py-16 px-4">
      <div className="w-full max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">자소서 기반 AI 면접 코치</h1>
        <p className="text-sm text-gray-500 mb-8">
          PDF 자소서를 업로드하면 맞춤 면접 질문과 자소서 진단을 제공합니다.
        </p>

        {state === 'confirming' || state === 'processing' ? (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                지원 직무 확인
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="예: 백엔드 엔지니어"
                disabled={isProcessing}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
              <p className="mt-1 text-xs text-gray-400">
                자소서에서 추출한 직무입니다. 수정 후 확정해주세요.
              </p>
            </div>

            {errorMsg && (
              <p className="text-sm text-red-600" role="alert">
                {errorMsg}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                disabled={isProcessing}
                className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? '분석 중...' : '확정 — 자소서 진단 시작'}
              </button>
              <button
                onClick={handleReset}
                disabled={isProcessing}
                className="px-4 py-2 text-sm text-gray-500 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                다시 업로드
              </button>
            </div>
          </div>
        ) : (
          <>
            <UploadForm onSubmit={handleSubmit} isLoading={isUploading} />
            {isUploading && (
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
