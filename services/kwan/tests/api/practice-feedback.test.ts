// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCallEnginePracticeFeedback } = vi.hoisted(() => ({
  mockCallEnginePracticeFeedback: vi.fn(),
}))

vi.mock('@/lib/engine-client', () => ({
  callEnginePracticeFeedback: mockCallEnginePracticeFeedback,
}))

import { POST } from '@/app/api/practice/feedback/route'

function makeMockResponse(ok: boolean, status: number, data: unknown): Response {
  return { ok, status, json: async () => data } as unknown as Response
}

const DEFAULT_FEEDBACK = {
  score: 78,
  feedback: {
    good: ['논리적인 구성', '구체적인 예시'],
    improve: ['결론 부분 보강 필요'],
  },
  keywords: ['REST API', '마이크로서비스'],
  improvedAnswerGuide: '더 구체적인 수치를 포함하세요.',
  comparisonDelta: null,
}

describe('POST /api/practice/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallEnginePracticeFeedback.mockResolvedValue(
      makeMockResponse(true, 200, DEFAULT_FEEDBACK)
    )
  })

  it('question 누락 → 400', async () => {
    const req = { json: async () => ({ answer: '답변입니다.' }) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('question과 answer가 필요합니다.')
  })

  it('answer 누락 → 400', async () => {
    const req = { json: async () => ({ question: '질문입니다.' }) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('question과 answer가 필요합니다.')
  })

  it('answer 공백 → 400', async () => {
    const req = { json: async () => ({ question: '질문입니다.', answer: '   ' }) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('question과 answer가 필요합니다.')
  })

  it('question이 string이 아닌 타입 (null, number) → 400', async () => {
    const req = { json: async () => ({ question: null, answer: '답변입니다.' }) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('question과 answer가 필요합니다.')
  })

  it('정상 흐름 (previousAnswer 없음) → 200', async () => {
    const req = {
      json: async () => ({ question: '자기소개 해주세요.', answer: '저는 백엔드 엔지니어입니다.' }),
    } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.score).toBe(78)
    expect(body.feedback.good).toHaveLength(2)
    expect(mockCallEnginePracticeFeedback).toHaveBeenCalledWith(
      '자기소개 해주세요.',
      '저는 백엔드 엔지니어입니다.',
      undefined
    )
  })

  it('정상 흐름 (previousAnswer 있음) → 200 + comparisonDelta', async () => {
    mockCallEnginePracticeFeedback.mockResolvedValueOnce(
      makeMockResponse(true, 200, {
        ...DEFAULT_FEEDBACK,
        comparisonDelta: { scoreDelta: 5, improvements: ['더 구체적인 예시'] },
      })
    )
    const req = {
      json: async () => ({
        question: '자기소개 해주세요.',
        answer: '저는 5년 경력 백엔드 엔지니어입니다.',
        previousAnswer: '저는 백엔드 엔지니어입니다.',
      }),
    } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.comparisonDelta.scoreDelta).toBe(5)
    expect(mockCallEnginePracticeFeedback).toHaveBeenCalledWith(
      '자기소개 해주세요.',
      '저는 5년 경력 백엔드 엔지니어입니다.',
      '저는 백엔드 엔지니어입니다.'
    )
  })

  it('엔진 오류 → 500', async () => {
    mockCallEnginePracticeFeedback.mockRejectedValueOnce(new Error('network error'))
    const req = {
      json: async () => ({ question: '질문', answer: '답변' }),
    } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('서버 오류가 발생했습니다.')
  })

  it('타임아웃 → 500 + 타임아웃 메시지', async () => {
    const timeoutError = new Error('timeout')
    timeoutError.name = 'TimeoutError'
    mockCallEnginePracticeFeedback.mockRejectedValueOnce(timeoutError)
    const req = {
      json: async () => ({ question: '질문', answer: '답변' }),
    } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('요청 시간이 초과됐습니다. 잠시 후 다시 시도해주세요.')
  })
})
