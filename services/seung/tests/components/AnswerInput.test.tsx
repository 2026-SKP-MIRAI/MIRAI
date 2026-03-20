import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AnswerInput from '@/components/AnswerInput'

describe('AnswerInput', () => {
  it('기본 렌더: textarea와 제출 버튼이 표시된다', () => {
    render(<AnswerInput onSubmit={vi.fn()} />)
    expect(screen.getByPlaceholderText('답변을 입력하세요...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '답변 제출' })).toBeInTheDocument()
  })

  it('hidden=true이면 렌더되지 않는다', () => {
    render(<AnswerInput onSubmit={vi.fn()} hidden={true} />)
    expect(screen.queryByPlaceholderText('답변을 입력하세요...')).not.toBeInTheDocument()
  })

  it('텍스트 입력 시 글자 수 카운터가 업데이트된다', async () => {
    render(<AnswerInput onSubmit={vi.fn()} />)
    const textarea = screen.getByPlaceholderText('답변을 입력하세요...')
    await userEvent.type(textarea, '안녕')
    expect(screen.getByText(/^2 \/ 5000$/)).toBeInTheDocument()
  })

  it('제출 후 textarea가 비워진다', async () => {
    render(<AnswerInput onSubmit={vi.fn()} />)
    const textarea = screen.getByPlaceholderText('답변을 입력하세요...')
    await userEvent.type(textarea, '테스트 답변')
    fireEvent.submit(textarea.closest('form')!)
    expect((textarea as HTMLTextAreaElement).value).toBe('')
  })

  it('빈 textarea 제출 시 onSubmit이 호출되지 않는다', async () => {
    const onSubmit = vi.fn()
    render(<AnswerInput onSubmit={onSubmit} />)
    const textarea = screen.getByPlaceholderText('답변을 입력하세요...')
    fireEvent.submit(textarea.closest('form')!)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  describe('beforeunload 이탈 경고', () => {
    let addEventListenerSpy: ReturnType<typeof vi.spyOn>
    let removeEventListenerSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      addEventListenerSpy = vi.spyOn(window, 'addEventListener')
      removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    })

    afterEach(() => {
      addEventListenerSpy.mockRestore()
      removeEventListenerSpy.mockRestore()
    })

    it('컴포넌트 마운트 시 beforeunload 이벤트가 등록된다', () => {
      render(<AnswerInput onSubmit={vi.fn()} />)
      expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    })

    it('textarea에 내용이 있을 때 beforeunload 핸들러가 e.preventDefault를 호출한다', async () => {
      render(<AnswerInput onSubmit={vi.fn()} />)
      const textarea = screen.getByPlaceholderText('답변을 입력하세요...')
      await userEvent.type(textarea, '작성 중인 답변')

      const event = new Event('beforeunload') as BeforeUnloadEvent
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
      window.dispatchEvent(event)
      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('textarea가 비어있을 때 beforeunload 핸들러가 e.preventDefault를 호출하지 않는다', () => {
      render(<AnswerInput onSubmit={vi.fn()} />)

      const event = new Event('beforeunload') as BeforeUnloadEvent
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
      window.dispatchEvent(event)
      expect(preventDefaultSpy).not.toHaveBeenCalled()
    })
  })
})
