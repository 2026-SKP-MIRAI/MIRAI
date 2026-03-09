'use client'

import { useRef, useState } from 'react'
import type { UploadState } from '@/lib/types'

type Props = {
  state: UploadState
  errorMessage?: string
  onSubmit: (file: File) => void
}

export default function UploadForm({ state, errorMessage, onSubmit }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isLoading = state === 'uploading' || state === 'processing'
  const isDisabled = isLoading || !selectedFile

  const buttonLabel = () => {
    if (state === 'uploading') return '업로드 중...'
    if (state === 'processing') return '자소서를 분석하고 있습니다...'
    return '질문 생성'
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedFile) onSubmit(selectedFile)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="pdf-input" className="text-sm font-medium text-gray-700">
          PDF 파일 선택
        </label>
        <input
          id="pdf-input"
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          disabled={isLoading}
          aria-label="PDF 파일"
          onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
        />
        {selectedFile && (
          <p className="text-xs text-gray-500">{selectedFile.name}</p>
        )}
      </div>

      {state === 'error' && errorMessage && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isDisabled}
        className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {buttonLabel()}
      </button>
    </form>
  )
}
