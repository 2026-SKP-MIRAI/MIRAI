import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import InterviewChat from '@/components/InterviewChat'
import type { QuestionWithPersona } from '@/domain/interview/types'

const mockFirstQuestion: QuestionWithPersona = {
  persona: 'hr',
  personaLabel: 'HR 담당자',
  question: '자기소개를 해주세요.',
  type: 'main',
}

const mockNextQuestion: QuestionWithPersona = {
  persona: 'tech_lead',
  personaLabel: '기술팀장',
  question: '사용한 기술 스택에 대해 설명해주세요.',
  type: 'main',
}

describe('InterviewChat', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('초기 질문이 페르소나 레이블과 함께 렌더된다', () => {
    render(
      <InterviewChat
        sessionId="session-123"
        initialQuestion={mockFirstQuestion}
        onComplete={vi.fn()}
      />
    )
    expect(screen.getByText('HR 담당자')).toBeInTheDocument()
    expect(screen.getByText('자기소개를 해주세요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /답변 제출/i })).toBeInTheDocument()
  })

  it('답변 입력 후 제출 → fetch 호출되고 다음 질문 렌더', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ nextQuestion: mockNextQuestion, sessionComplete: false }),
        { status: 200 }
      )
    )
    vi.stubGlobal('fetch', mockFetch)

    render(
      <InterviewChat
        sessionId="session-123"
        initialQuestion={mockFirstQuestion}
        onComplete={vi.fn()}
      />
    )

    const textarea = screen.getByRole('textbox', { name: /답변 입력/i })
    fireEvent.change(textarea, { target: { value: '안녕하세요. 저는 개발자입니다.' } })
    fireEvent.click(screen.getByRole('button', { name: /답변 제출/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/interview/answer',
        expect.objectContaining({ method: 'POST' })
      )
    })

    await waitFor(() => {
      expect(screen.getByText('기술팀장')).toBeInTheDocument()
      expect(screen.getByText('사용한 기술 스택에 대해 설명해주세요.')).toBeInTheDocument()
    })
  })

  it('sessionComplete=true 응답 시 완료 화면 표시', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ nextQuestion: null, sessionComplete: true }),
        { status: 200 }
      )
    )
    vi.stubGlobal('fetch', mockFetch)

    render(
      <InterviewChat
        sessionId="session-123"
        initialQuestion={mockFirstQuestion}
        onComplete={vi.fn()}
      />
    )

    const textarea = screen.getByRole('textbox', { name: /답변 입력/i })
    fireEvent.change(textarea, { target: { value: '마지막 답변입니다.' } })
    fireEvent.click(screen.getByRole('button', { name: /답변 제출/i }))

    await waitFor(() => {
      expect(screen.getByText(/면접이 완료되었습니다/i)).toBeInTheDocument()
    })
  })

  it('"처음으로" 버튼 클릭 → onComplete 콜백 호출', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ nextQuestion: null, sessionComplete: true }),
        { status: 200 }
      )
    )
    vi.stubGlobal('fetch', mockFetch)
    const onComplete = vi.fn()

    render(
      <InterviewChat
        sessionId="session-123"
        initialQuestion={mockFirstQuestion}
        onComplete={onComplete}
      />
    )

    fireEvent.change(screen.getByRole('textbox', { name: /답변 입력/i }), {
      target: { value: '답변' },
    })
    fireEvent.click(screen.getByRole('button', { name: /답변 제출/i }))

    await waitFor(() => screen.getByText(/처음으로/i))
    fireEvent.click(screen.getByRole('button', { name: /처음으로/i }))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
