import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UploadForm from '@/components/UploadForm'

describe('UploadForm', () => {
  it('idle 상태: 파일 input + "질문 생성" 버튼 렌더', () => {
    render(<UploadForm onSubmit={vi.fn()} isLoading={false} />)
    expect(screen.getByLabelText(/pdf/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /질문 생성/i })).toBeInTheDocument()
  })

  it('PDF 아닌 파일 선택 → 인라인 에러 표시', () => {
    render(<UploadForm onSubmit={vi.fn()} isLoading={false} />)
    const input = screen.getByLabelText(/pdf/i)
    const txtFile = new File(['content'], 'resume.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [txtFile] } })
    expect(screen.getByText(/pdf 파일만/i)).toBeInTheDocument()
  })

  it('로딩 중: 버튼 비활성화 + 로딩 텍스트', () => {
    render(<UploadForm onSubmit={vi.fn()} isLoading={true} />)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent(/분석 중/i)
  })

  it('PDF 선택 후 제출 → onSubmit(file) 호출', () => {
    const onSubmit = vi.fn()
    render(<UploadForm onSubmit={onSubmit} isLoading={false} />)
    const input = screen.getByLabelText(/pdf/i)
    const pdfFile = new File(['%PDF'], 'resume.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [pdfFile] } })
    fireEvent.click(screen.getByRole('button', { name: /질문 생성/i }))
    expect(onSubmit).toHaveBeenCalledWith(pdfFile)
  })

  it('파일 미선택 상태에서 제출 → onSubmit 미호출', () => {
    const onSubmit = vi.fn()
    render(<UploadForm onSubmit={onSubmit} isLoading={false} />)
    fireEvent.click(screen.getByRole('button', { name: /질문 생성/i }))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
