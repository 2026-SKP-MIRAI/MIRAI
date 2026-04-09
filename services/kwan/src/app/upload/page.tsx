'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import UploadForm from '@/components/UploadForm'
import type { GenerateResult, UploadState } from '@/domain/interview/types'

export default function UploadPage() {
  const router = useRouter()
  const [state, setState] = useState<UploadState>('idle')
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [targetRole, setTargetRole] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

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

  async function handleConfirm() {
    if (!result?.resumeId) return
    setState('processing')
    setErrorMsg(null)

    if (pendingFile && targetRole.trim() && result.resumeId) {
      const bgForm = new FormData()
      bgForm.append('file', pendingFile)
      bgForm.append('targetRole', targetRole.trim())
      bgForm.append('resumeId', result.resumeId)
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

      router.push(`/diagnosis?resumeId=${encodeURIComponent(result.resumeId)}`)
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
    <main className="min-h-screen flex flex-col items-center py-16 px-4" style={{ background: 'var(--kwan-bg)' }}>
      <div className="w-full max-w-xl">
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--kwan-text)', marginBottom: '0.5rem' }}>
          자소서 업로드
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--kwan-text-2)', marginBottom: '2rem' }}>
          PDF 자소서를 업로드하면 맞춤 면접 질문과 자소서 진단을 제공합니다.
        </p>

        {state === 'confirming' || state === 'processing' ? (
          <div className="matte-card p-6 flex flex-col gap-4">
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--kwan-text-2)', marginBottom: '0.375rem' }}>
                지원 직무 확인
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="예: 백엔드 엔지니어"
                disabled={isProcessing}
                className="input-dark"
                style={{ opacity: isProcessing ? 0.5 : 1 }}
              />
              <p style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: 'var(--kwan-text-muted)' }}>
                자소서에서 추출한 직무입니다. 수정 후 확정해주세요.
              </p>
            </div>

            {errorMsg && (
              <p style={{ fontSize: '0.875rem', color: 'var(--kwan-error)' }} role="alert">
                {errorMsg}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                disabled={isProcessing}
                className="btn-primary flex-1"
                style={{ padding: '0.75rem', fontSize: '0.875rem' }}
              >
                {isProcessing ? '분석 중...' : '확정 — 자소서 진단 시작'}
              </button>
              <button
                onClick={handleReset}
                disabled={isProcessing}
                className="btn-outline"
                style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}
              >
                다시 업로드
              </button>
            </div>
          </div>
        ) : (
          <>
            <UploadForm onSubmit={handleSubmit} isLoading={isUploading} />
            {isUploading && (
              <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--kwan-teal)' }} className="animate-pulse">
                자소서를 분석하고 있습니다...
              </p>
            )}
            {state === 'error' && errorMsg && (
              <div style={{ marginTop: '1rem' }} className="flex flex-col gap-2">
                <p style={{ fontSize: '0.875rem', color: 'var(--kwan-error)' }} role="alert">
                  {errorMsg}
                </p>
                <button
                  onClick={handleReset}
                  style={{ fontSize: '0.875rem', color: 'var(--kwan-text-2)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}
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
