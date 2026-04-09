import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UploadForm from '@/components/UploadForm'

describe('UploadForm', () => {
  it('idle 상태: pdf 파일 input + "파일 선택" 버튼 렌더', () => {
    render(<UploadForm onSubmit={vi.fn()} isLoading={false} />)
    expect(screen.getByLabelText(/pdf 파일 선택/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /파일 선택/i })).toBeInTheDocument()
  })

  it('PDF 아닌 파일 선택 → 인라인 에러 표시, onSubmit 미호출', () => {
    const onSubmit = vi.fn()
    render(<UploadForm onSubmit={onSubmit} isLoading={false} />)
    const input = screen.getByLabelText(/pdf 파일 선택/i)
    const txtFile = new File(['content'], 'resume.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [txtFile] } })
    expect(screen.getByText(/pdf 파일만/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('로딩 중: 스피너 영역 렌더 + 파일 선택 버튼 없음', () => {
    render(<UploadForm onSubmit={vi.fn()} isLoading={true} />)
    expect(screen.getByText(/자소서를 분석하고 있습니다/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /파일 선택/i })).not.toBeInTheDocument()
  })

  it('PDF 선택 → 즉시 onSubmit(file) 호출', () => {
    const onSubmit = vi.fn()
    render(<UploadForm onSubmit={onSubmit} isLoading={false} />)
    const input = screen.getByLabelText(/pdf 파일 선택/i)
    const pdfFile = new File(['%PDF'], 'resume.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [pdfFile] } })
    expect(onSubmit).toHaveBeenCalledWith(pdfFile)
  })

  it('PDF 선택 후 파일명 표시', () => {
    render(<UploadForm onSubmit={vi.fn()} isLoading={false} />)
    const input = screen.getByLabelText(/pdf 파일 선택/i)
    const pdfFile = new File(['%PDF'], 'resume.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [pdfFile] } })
    expect(screen.getByText(/resume\.pdf/i)).toBeInTheDocument()
  })
})
