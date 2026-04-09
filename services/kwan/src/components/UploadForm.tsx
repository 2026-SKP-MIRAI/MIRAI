'use client'

import { useRef, useState } from 'react'

interface Props {
  onSubmit: (file: File) => void
  isLoading: boolean
}

export default function UploadForm({ onSubmit, isLoading }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    if (!selected) return
    if (selected.type !== 'application/pdf') {
      setFile(null)
      setFileError('PDF 파일만 업로드 가능합니다.')
      return
    }
    setFileError(null)
    setFile(selected)
    onSubmit(selected)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (!dropped) return
    if (dropped.type !== 'application/pdf') {
      setFileError('PDF 파일만 업로드 가능합니다.')
      return
    }
    setFileError(null)
    setFile(dropped)
    onSubmit(dropped)
  }

  const dropzoneStyle: React.CSSProperties = {
    border: `2px dashed ${dragging ? 'var(--kwan-teal)' : 'rgba(45,212,191,0.35)'}`,
    borderRadius: 'var(--kwan-radius)',
    background: dragging ? 'var(--kwan-teal-dim)' : 'var(--kwan-surface)',
    padding: '3rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    cursor: isLoading ? 'not-allowed' : 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
    textAlign: 'center',
    opacity: isLoading ? 0.5 : 1,
  }

  if (isLoading) {
    return (
      <div style={dropzoneStyle}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '3px solid var(--kwan-teal-dim)',
          borderTopColor: 'var(--kwan-teal)',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ fontSize: '0.875rem', color: 'var(--kwan-teal)' }}>자소서를 분석하고 있습니다...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-label="PDF 파일 선택"
      />

      <div
        style={dropzoneStyle}
        onClick={() => !isLoading && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="PDF 파일 업로드 영역"
      >
        {/* Document icon */}
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          style={{ color: 'var(--kwan-teal)', opacity: 0.7 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 3v6h6" />
        </svg>

        <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--kwan-text)' }}>
          PDF 파일을 여기에 드래그하거나 클릭하여 업로드
        </p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--kwan-text-muted)' }}>
          최대 10MB · PDF만 지원
        </p>

        <button
          type="button"
          className="btn-primary"
          style={{ padding: '0.625rem 1.5rem', fontSize: '0.875rem', marginTop: '0.25rem' }}
          onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
        >
          파일 선택
        </button>
      </div>

      {fileError && (
        <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--kwan-error)' }} role="alert">
          {fileError}
        </p>
      )}
      {file && !fileError && (
        <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--kwan-success)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {file.name}
        </p>
      )}
    </div>
  )
}
