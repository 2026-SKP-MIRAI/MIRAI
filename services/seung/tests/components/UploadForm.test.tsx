import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UploadForm from '@/components/UploadForm'

describe('UploadForm', () => {
  it('idle 상태: 파일 입력과 "질문 생성" 버튼 렌더', () => {
    render(<UploadForm state="idle" onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: /질문 생성/ })).toBeInTheDocument()
  })

  it('idle 상태: 파일 미선택 시 버튼 비활성화', () => {
    render(<UploadForm state="idle" onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: /질문 생성/ })).toBeDisabled()
  })

  it('uploading 상태: 버튼 비활성화 + 로딩 텍스트', () => {
    render(<UploadForm state="uploading" onSubmit={vi.fn()} />)
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByText(/업로드/)).toBeInTheDocument()
  })

  it('processing 상태: 버튼 비활성화 + 분석 텍스트', () => {
    render(<UploadForm state="processing" onSubmit={vi.fn()} />)
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByText(/분석/)).toBeInTheDocument()
  })

  it('error 상태: 에러 메시지 표시', () => {
    render(
      <UploadForm
        state="error"
        errorMessage="서버 오류가 발생했습니다."
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText(/서버 오류가 발생했습니다/)).toBeInTheDocument()
  })

  it('파일 선택 시 버튼 활성화', async () => {
    const user = userEvent.setup()
    render(<UploadForm state="idle" onSubmit={vi.fn()} />)

    const input = screen.getByLabelText(/PDF 파일/)
    const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })
    await user.upload(input, file)

    expect(screen.getByRole('button', { name: /질문 생성/ })).toBeEnabled()
  })

  it('파일 선택 후 버튼 클릭 시 onSubmit 호출', async () => {
    const user = userEvent.setup()
    const handleSubmit = vi.fn()
    render(<UploadForm state="idle" onSubmit={handleSubmit} />)

    const input = screen.getByLabelText(/PDF 파일/)
    const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })
    await user.upload(input, file)
    await user.click(screen.getByRole('button', { name: /질문 생성/ }))

    expect(handleSubmit).toHaveBeenCalledOnce()
    expect(handleSubmit).toHaveBeenCalledWith(file)
  })
})
