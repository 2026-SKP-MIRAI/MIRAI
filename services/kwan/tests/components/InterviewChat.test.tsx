import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import InterviewChat from '@/components/InterviewChat'
import type { QuestionWithPersona } from '@/domain/interview/types'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
}))

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
    mockPush.mockReset()
  })

  it('완료 화면에서 리포트 생성 버튼 렌더 확인', async () => {
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

    fireEvent.change(screen.getByRole('textbox', { name: /답변 입력/i }), {
      target: { value: '답변' },
    })
    fireEvent.click(screen.getByRole('button', { name: /답변 제출/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /리포트 생성/i })).toBeInTheDocument()
    })
  })

  it('리포트 생성 버튼 클릭 → POST /api/report/generate 호출', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ nextQuestion: null, sessionComplete: true }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ reportId: 'report-1' }),
          { status: 201 }
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

    fireEvent.change(screen.getByRole('textbox', { name: /답변 입력/i }), {
      target: { value: '답변' },
    })
    fireEvent.click(screen.getByRole('button', { name: /답변 제출/i }))

    await waitFor(() => screen.getByRole('button', { name: /리포트 생성/i }))
    fireEvent.click(screen.getByRole('button', { name: /리포트 생성/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/report/generate',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('리포트 생성 로딩 중 버튼 비활성화', async () => {
    let resolveReport!: (value: Response) => void
    const reportPromise = new Promise<Response>((res) => { resolveReport = res })

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ nextQuestion: null, sessionComplete: true }),
          { status: 200 }
        )
      )
      .mockReturnValueOnce(reportPromise)
    vi.stubGlobal('fetch', mockFetch)

    render(
      <InterviewChat
        sessionId="session-123"
        initialQuestion={mockFirstQuestion}
        onComplete={vi.fn()}
      />
    )

    fireEvent.change(screen.getByRole('textbox', { name: /답변 입력/i }), {
      target: { value: '답변' },
    })
    fireEvent.click(screen.getByRole('button', { name: /답변 제출/i }))

    await waitFor(() => screen.getByRole('button', { name: /리포트 생성/i }))
    fireEvent.click(screen.getByRole('button', { name: /리포트 생성/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /생성 중/i })).toBeDisabled()
    })

    await act(async () => {
      resolveReport(new Response(JSON.stringify({ reportId: 'report-1' }), { status: 201 }))
    })
  })

  it('리포트 생성 성공 → /report?reportId=xxx 이동', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ nextQuestion: null, sessionComplete: true }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ reportId: 'report-abc' }),
          { status: 201 }
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

    fireEvent.change(screen.getByRole('textbox', { name: /답변 입력/i }), {
      target: { value: '답변' },
    })
    fireEvent.click(screen.getByRole('button', { name: /답변 제출/i }))

    await waitFor(() => screen.getByRole('button', { name: /리포트 생성/i }))
    fireEvent.click(screen.getByRole('button', { name: /리포트 생성/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/report?reportId=report-abc')
    })
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

  it('연습 모드 — 답변 제출 후 피드백 패널 표시', async () => {
    const mockFeedback = {
      score: 78,
      feedback: { good: ['구체적 사례를 잘 들었습니다.'], improve: ['수치를 추가하면 더 좋습니다.'] },
      keywords: ['협업', '문제해결'],
      improvedAnswerGuide: '수치와 결과를 추가해보세요.',
      comparisonDelta: null,
    }
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ nextQuestion: mockNextQuestion, sessionComplete: false }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockFeedback), { status: 200 })
      )
    vi.stubGlobal('fetch', mockFetch)

    render(
      <InterviewChat
        sessionId="session-123"
        initialQuestion={mockFirstQuestion}
        onComplete={vi.fn()}
        interviewMode="practice"
      />
    )

    fireEvent.change(screen.getByRole('textbox', { name: /답변 입력/i }), {
      target: { value: '답변입니다.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /답변 제출/i }))

    await waitFor(() => {
      expect(screen.getByTestId('practice-feedback')).toBeInTheDocument()
      expect(screen.getByText('78점')).toBeInTheDocument()
      expect(screen.getByText(/구체적 사례를 잘 들었습니다/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /다시 답변하기/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /다음 질문/i })).toBeInTheDocument()
  })

  it('연습 모드 — "다시 답변하기" 클릭 → 입력 폼 복원', async () => {
    const mockFeedback = {
      score: 70,
      feedback: { good: ['좋습니다.'], improve: ['더 구체적으로.'] },
      keywords: [],
      improvedAnswerGuide: '구체적 수치를 추가하세요.',
      comparisonDelta: null,
    }
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ nextQuestion: mockNextQuestion, sessionComplete: false }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockFeedback), { status: 200 })
      )
    vi.stubGlobal('fetch', mockFetch)

    render(
      <InterviewChat
        sessionId="session-123"
        initialQuestion={mockFirstQuestion}
        onComplete={vi.fn()}
        interviewMode="practice"
      />
    )

    fireEvent.change(screen.getByRole('textbox', { name: /답변 입력/i }), {
      target: { value: '첫 번째 답변.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /답변 제출/i }))

    await waitFor(() => screen.getByRole('button', { name: /다시 답변하기/i }))
    fireEvent.click(screen.getByRole('button', { name: /다시 답변하기/i }))

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /답변 입력/i })).toBeInTheDocument()
    })
    expect(screen.queryByTestId('practice-feedback')).not.toBeInTheDocument()
  })

  it('연습 모드 — "다음 질문" 클릭 → 다음 질문으로 이동', async () => {
    const mockFeedback = {
      score: 82,
      feedback: { good: ['좋아요.'], improve: ['개선점.'] },
      keywords: ['리더십'],
      improvedAnswerGuide: '가이드.',
      comparisonDelta: null,
    }
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ nextQuestion: mockNextQuestion, sessionComplete: false }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockFeedback), { status: 200 })
      )
    vi.stubGlobal('fetch', mockFetch)

    render(
      <InterviewChat
        sessionId="session-123"
        initialQuestion={mockFirstQuestion}
        onComplete={vi.fn()}
        interviewMode="practice"
      />
    )

    fireEvent.change(screen.getByRole('textbox', { name: /답변 입력/i }), {
      target: { value: '답변.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /답변 제출/i }))

    await waitFor(() => screen.getByRole('button', { name: /다음 질문/i }))
    fireEvent.click(screen.getByRole('button', { name: /다음 질문/i }))

    await waitFor(() => {
      expect(screen.getByText('기술팀장')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('practice-feedback')).not.toBeInTheDocument()
  })

  it('연습 모드 — 재답변 후 retry-feedback 상태: "다시 답변하기" 버튼 없음', async () => {
    const mockFeedback = {
      score: 85,
      feedback: { good: ['더 좋아졌습니다.'], improve: ['수치 추가'] },
      keywords: ['성장'],
      improvedAnswerGuide: '좋습니다.',
      comparisonDelta: { scoreDelta: 7, improvements: ['구체성 향상'] },
    }
    const mockFetch = vi.fn()
      // 첫 번째 답변: /answer
      .mockResolvedValueOnce(new Response(JSON.stringify({ nextQuestion: mockNextQuestion, sessionComplete: false }), { status: 200 }))
      // 첫 번째 /practice/feedback
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...mockFeedback, comparisonDelta: null }), { status: 200 }))
      // 재답변: /answer
      .mockResolvedValueOnce(new Response(JSON.stringify({ nextQuestion: mockNextQuestion, sessionComplete: false }), { status: 200 }))
      // 두 번째 /practice/feedback (retry)
      .mockResolvedValueOnce(new Response(JSON.stringify(mockFeedback), { status: 200 }))
    vi.stubGlobal('fetch', mockFetch)

    render(<InterviewChat sessionId="session-123" initialQuestion={mockFirstQuestion} onComplete={vi.fn()} interviewMode="practice" />)

    // 첫 번째 답변 제출
    fireEvent.change(screen.getByRole('textbox', { name: /답변 입력/i }), { target: { value: '첫 답변.' } })
    fireEvent.click(screen.getByRole('button', { name: /답변 제출/i }))
    await waitFor(() => screen.getByRole('button', { name: /다시 답변하기/i }))

    // 다시 답변하기 클릭
    fireEvent.click(screen.getByRole('button', { name: /다시 답변하기/i }))
    await waitFor(() => screen.getByRole('textbox', { name: /답변 입력/i }))

    // 재답변 제출
    fireEvent.change(screen.getByRole('textbox', { name: /답변 입력/i }), { target: { value: '개선된 답변.' } })
    fireEvent.click(screen.getByRole('button', { name: /답변 제출/i }))

    // retry-feedback: "다시 답변하기" 없고 "다음 질문"만 있어야 함
    await waitFor(() => screen.getByTestId('practice-feedback'))
    expect(screen.queryByRole('button', { name: /다시 답변하기/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /다음 질문/i })).toBeInTheDocument()
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
