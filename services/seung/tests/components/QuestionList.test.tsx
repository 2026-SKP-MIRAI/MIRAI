import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuestionList from '@/components/QuestionList'
import type { Question } from '@/lib/types'

const mockQuestions: Question[] = [
  { category: '직무 역량', question: '담당한 역할을 구체적으로 설명해 주세요.' },
  { category: '직무 역량', question: '가장 어려웠던 기술 과제는 무엇인가요?' },
  { category: '경험의 구체성', question: '팀 내 갈등 상황을 어떻게 해결했나요?' },
  { category: '기술 역량', question: 'React를 선택한 이유는 무엇인가요?' },
]

describe('QuestionList', () => {
  it('카테고리별로 그룹핑하여 렌더', () => {
    render(<QuestionList questions={mockQuestions} onReset={vi.fn()} />)
    expect(screen.getByText('직무 역량')).toBeInTheDocument()
    expect(screen.getByText('경험의 구체성')).toBeInTheDocument()
    expect(screen.getByText('기술 역량')).toBeInTheDocument()
  })

  it('질문 텍스트 모두 렌더', () => {
    render(<QuestionList questions={mockQuestions} onReset={vi.fn()} />)
    expect(screen.getByText(/담당한 역할을 구체적으로/)).toBeInTheDocument()
    expect(screen.getByText(/팀 내 갈등 상황/)).toBeInTheDocument()
    expect(screen.getByText(/React를 선택한 이유/)).toBeInTheDocument()
  })

  it('"다시 하기" 버튼 렌더', () => {
    render(<QuestionList questions={mockQuestions} onReset={vi.fn()} />)
    expect(screen.getByRole('button', { name: /다시 하기/ })).toBeInTheDocument()
  })

  it('"다시 하기" 버튼 클릭 시 onReset 호출', async () => {
    const user = userEvent.setup()
    const handleReset = vi.fn()
    render(<QuestionList questions={mockQuestions} onReset={handleReset} />)

    await user.click(screen.getByRole('button', { name: /다시 하기/ }))
    expect(handleReset).toHaveBeenCalledOnce()
  })

  it('같은 카테고리 질문 수 정확히 렌더 (직무 역량 2개)', () => {
    render(<QuestionList questions={mockQuestions} onReset={vi.fn()} />)
    const questions = screen.getAllByRole('listitem')
    expect(questions.length).toBe(4)
  })
})
