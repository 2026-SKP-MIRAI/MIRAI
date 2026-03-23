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
  const [isDragging, setIsDragging] = useState(false)
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!isLoading) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (isLoading) return
    const file = e.dataTransfer.files[0]
    if (file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      setSelectedFile(file)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {/* 드롭 존 */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isLoading && inputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
            isLoading ? 'cursor-not-allowed opacity-60' :
            isDragging ? 'border-[#4361ee] bg-blue-50' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <svg className={`h-8 w-8 ${isDragging ? 'text-[#4361ee]' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {selectedFile ? (
              <p className="text-sm font-medium text-[#4361ee]">{selectedFile.name}</p>
            ) : (
              <p className="text-sm text-gray-500">
                {isDragging ? 'PDF를 놓으세요' : 'PDF를 여기에 끌어다 놓거나 클릭해서 선택'}
              </p>
            )}
            <p className="text-xs text-gray-400">PDF 파일만 가능, 최대 5MB</p>
          </div>
        </div>

        {/* sr-only input — Playwright setInputFiles() 호환 유지 */}
        <input
          id="pdf-input"
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          disabled={isLoading}
          aria-label="PDF 파일"
          onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
      </div>

      {state === 'error' && errorMessage && (
        <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isDisabled}
        className="flex items-center justify-center gap-2 rounded-lg bg-[#1a1a2e] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#16213e] disabled:cursor-not-allowed disabled:opacity-50"
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
