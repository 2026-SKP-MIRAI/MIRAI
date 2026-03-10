'use client'

import { useRef, useState } from 'react'

interface Props {
  onSubmit: (file: File) => void
  isLoading: boolean
}

export default function UploadForm({ onSubmit, isLoading }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    if (!selected) {
      setFile(null)
      setFileError(null)
      return
    }
    if (selected.type !== 'application/pdf') {
      setFile(null)
      setFileError('PDF 파일만 업로드 가능합니다.')
      return
    }
    setFileError(null)
    setFile(selected)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    onSubmit(file)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label htmlFor="pdf-upload" className="font-medium text-sm">
        PDF 자소서 업로드
      </label>
      <input
        id="pdf-upload"
        ref={inputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        disabled={isLoading}
        aria-label="PDF 파일 선택"
        className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />
      {fileError && (
        <p className="text-sm text-red-600" role="alert">
          {fileError}
        </p>
      )}
      {file && !fileError && (
        <p className="text-sm text-gray-500">선택된 파일: {file.name}</p>
      )}
      <button
        type="submit"
        disabled={isLoading || !file}
        className="py-2 px-6 rounded bg-blue-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
      >
        {isLoading ? '분석 중...' : '질문 생성'}
      </button>
    </form>
  )
}
