import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import QuestionList from '@/components/QuestionList'
import type { Question } from '@/domain/interview/types'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

const mockQuestions: Question[] = [
  { category: '직무 역량', question: '담당 역할을 설명해주세요.' },
  { category: '직무 역량', question: '팀에서의 역할은 무엇이었나요?' },
  { category: '기술 역량', question: 'React를 사용한 이유는 무엇인가요?' },
  { category: '경험의 구체성', question: '갈등을 어떻게 해결했나요?' },
]

describe('QuestionList', () => {
  it('questions 배열 → 카테고리별 그룹 렌더', () => {
    render(
      <QuestionList
        questions={mockQuestions}
        resumeId="resume-123"
        onReset={vi.fn()}
      />
    )
    expect(screen.getByText('직무 역량')).toBeInTheDocument()
    expect(screen.getByText('기술 역량')).toBeInTheDocument()
    expect(screen.getByText('경험의 구체성')).toBeInTheDocument()
    expect(screen.getByText('담당 역할을 설명해주세요.')).toBeInTheDocument()
    expect(screen.getByText('React를 사용한 이유는 무엇인가요?')).toBeInTheDocument()
  })

  it('각 카테고리 내 질문 수 정확히 표시', () => {
    render(
      <QuestionList
        questions={mockQuestions}
        resumeId="resume-123"
        onReset={vi.fn()}
      />
    )
    const jobQuestions = screen.getAllByText(/담당 역할|팀에서의 역할/)
    expect(jobQuestions).toHaveLength(2)
  })

  it('"다시 하기" 버튼 클릭 → onReset 호출', () => {
    const onReset = vi.fn()
    render(
      <QuestionList
        questions={mockQuestions}
        resumeId="resume-123"
        onReset={onReset}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /다시 하기/i }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('빈 질문 배열 → 결과 없음 메시지', () => {
    render(
      <QuestionList
        questions={[]}
        resumeId="resume-123"
        onReset={vi.fn()}
      />
    )
    expect(screen.getByText(/질문이 없습니다/i)).toBeInTheDocument()
  })

  it('"면접 시작" 버튼 클릭 → fetch 호출 후 /interview 이동', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ sessionId: 'session-123', firstQuestion: {} }),
        { status: 200 }
      )
    )
    vi.stubGlobal('fetch', mockFetch)

    render(
      <QuestionList
        questions={mockQuestions}
        resumeId="resume-123"
        onReset={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /면접 시작/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/interview/start',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })
})
