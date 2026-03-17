import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import InterviewChat from '@/components/InterviewChat'
import type { QuestionWithPersona } from '@/lib/types'

type Message =
  | { id: string; type: 'question'; data: QuestionWithPersona }
  | { id: string; type: 'answer'; text: string }

describe('InterviewChat', () => {
  it('질문 버블이 personaLabel과 함께 렌더된다', () => {
    const messages: Message[] = [
      {
        id: 'msg-1',
        type: 'question',
        data: {
          persona: 'hr',
          personaLabel: 'HR 면접관',
          question: '자기소개를 해주세요.',
          type: 'main',
        },
      },
    ]

    render(
      <InterviewChat messages={messages} sessionComplete={false} />
    )

    expect(screen.getByText('HR 면접관')).toBeInTheDocument()
    expect(screen.getByText('자기소개를 해주세요.')).toBeInTheDocument()
  })

  it('type="follow_up"이면 꼬리질문 배지가 표시된다', () => {
    const messages: Message[] = [
      {
        id: 'msg-1',
        type: 'question',
        data: {
          persona: 'tech_lead',
          personaLabel: '기술 리드',
          question: '좀 더 구체적으로 설명해주세요.',
          type: 'follow_up',
        },
      },
    ]

    render(
      <InterviewChat messages={messages} sessionComplete={false} />
    )

    expect(screen.getByText('꼬리질문')).toBeInTheDocument()
  })

  it('sessionComplete=true이면 완료 화면이 표시된다', () => {
    render(
      <InterviewChat messages={[]} sessionComplete={true} onRestart={vi.fn()} />
    )

    expect(screen.getByText('면접이 완료되었습니다.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시작' })).toBeInTheDocument()
  })

  it('답변 버블이 렌더된다', () => {
    const messages: Message[] = [
      { id: 'msg-1', type: 'answer', text: '저는 개발자입니다.' },
    ]

    render(
      <InterviewChat messages={messages} sessionComplete={false} />
    )

    expect(screen.getByText('저는 개발자입니다.')).toBeInTheDocument()
  })

  it('onReport prop 전달 시 "리포트 생성하기" 버튼이 표시된다', () => {
    render(
      <InterviewChat
        messages={[]}
        sessionComplete={true}
        onReport={vi.fn()}
        isGeneratingReport={false}
      />
    )

    expect(screen.getByRole('button', { name: '리포트 생성하기' })).toBeInTheDocument()
  })

  it('isGeneratingReport=true 시 버튼이 disabled되고 "리포트 생성 중..." 텍스트가 표시된다', () => {
    render(
      <InterviewChat
        messages={[]}
        sessionComplete={true}
        onReport={vi.fn()}
        isGeneratingReport={true}
      />
    )

    const button = screen.getByRole('button', { name: /리포트 생성 중/ })
    expect(button).toBeDisabled()
  })

  it('main 타입 질문에는 꼬리질문 배지가 없다', () => {
    const messages: Message[] = [
      {
        id: 'msg-1',
        type: 'question',
        data: {
          persona: 'hr',
          personaLabel: 'HR 면접관',
          question: '자기소개를 해주세요.',
          type: 'main',
        },
      },
    ]

    render(
      <InterviewChat messages={messages} sessionComplete={false} />
    )

    expect(screen.queryByText('꼬리질문')).not.toBeInTheDocument()
  })
})
