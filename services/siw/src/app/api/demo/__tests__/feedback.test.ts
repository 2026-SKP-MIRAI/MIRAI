import { describe, it, expect, vi, beforeEach } from 'vitest'

// fetch mock
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { POST } from '../feedback/route'

function makeRequest(body: object) {
  return new Request('http://localhost/api/demo/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const mockFeedbackResponse = {
  score: 72,
  feedback: { good: ['논리적'], improve: ['구체성 부족'] },
  keywords: ['협업', '성장'],
  improvedAnswerGuide: '더 구체적인 예시를 들어주세요.',
  usage: { tokens: 100 },
}

describe('POST /api/demo/feedback', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('question 미입력 시 400 반환', async () => {
    const res = await POST(makeRequest({ answer: '답변입니다.' }))
    expect(res.status).toBe(400)
  })

  it('answer 미입력 시 400 반환', async () => {
    const res = await POST(makeRequest({ question: '자기소개를 해주세요.' }))
    expect(res.status).toBe(400)
  })

  it('answer가 공백만인 경우 400 반환', async () => {
    const res = await POST(makeRequest({ question: '자기소개를 해주세요.', answer: '   ' }))
    expect(res.status).toBe(400)
  })

  it('인증 없이 정상 호출 가능 (비로그인 허용)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockFeedbackResponse), { status: 200 })
    )

    const res = await POST(makeRequest({ question: '자기소개를 해주세요.', answer: '저는 개발자입니다.' }))
    expect(res.status).toBe(200)
  })

  it('엔진 응답을 그대로 반환한다 (usage 제외)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockFeedbackResponse), { status: 200 })
    )

    const res = await POST(makeRequest({ question: '자기소개를 해주세요.', answer: '저는 개발자입니다.' }))
    const data = await res.json()

    expect(data.score).toBe(72)
    expect(data.feedback).toBeDefined()
    expect(data.keywords).toBeDefined()
    expect(data.improvedAnswerGuide).toBeDefined()
    // usage는 제거됨
    expect(data.usage).toBeUndefined()
  })

  it('엔진이 실패하면 502 반환', async () => {
    mockFetch.mockResolvedValueOnce(new Response('error', { status: 500 }))

    const res = await POST(makeRequest({ question: '자기소개를 해주세요.', answer: '저는 개발자입니다.' }))
    expect(res.status).toBe(502)
  })

  it('네트워크 오류 시 502 반환', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'))

    const res = await POST(makeRequest({ question: '자기소개를 해주세요.', answer: '저는 개발자입니다.' }))
    expect(res.status).toBe(502)
  })

  it('엔진에 question과 answer를 그대로 전달한다', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockFeedbackResponse), { status: 200 })
    )

    await POST(makeRequest({ question: '협업 경험은?', answer: '팀 프로젝트를 진행했습니다.' }))

    const [, options] = mockFetch.mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.question).toBe('협업 경험은?')
    expect(body.answer).toBe('팀 프로젝트를 진행했습니다.')
  })
})
