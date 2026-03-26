import { describe, it, expect, vi, beforeEach } from 'vitest'

// fetch mock
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { POST } from '../evaluate/route'

function makeRequest(body: object) {
  return new Request('http://localhost/api/demo/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const mockEvaluateResponse = {
  scores: {
    communication: 80,
    problemSolving: 70,
    logicalThinking: 65,
    jobExpertise: 75,
    cultureFit: 85,
    leadership: 60,
    creativity: 70,
    sincerity: 90,
  },
  totalScore: 74,
  summary: '전반적으로 우수한 답변입니다.',
  axisFeedbacks: [
    { axis: 'communication', axisLabel: '의사소통', score: 80, type: 'strength', feedback: '명확하게 설명했습니다.' },
    { axis: 'cultureFit', axisLabel: '조직 적합성', score: 85, type: 'strength', feedback: '팀워크를 강조했습니다.' },
    { axis: 'sincerity', axisLabel: '성실성', score: 90, type: 'strength', feedback: '성실한 태도가 보입니다.' },
  ],
  usage: { tokens: 500 },
}

const validBody = {
  targetRole: '프론트엔드 개발자',
  question: '자기소개를 해주세요.',
  answer: '저는 3년차 프론트엔드 개발자입니다.',
  persona: 'tech_lead',
}

describe('POST /api/demo/evaluate', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('targetRole 미입력 시 400 반환', async () => {
    const { targetRole: _, ...rest } = validBody
    const res = await POST(makeRequest(rest))
    expect(res.status).toBe(400)
  })

  it('question 미입력 시 400 반환', async () => {
    const { question: _, ...rest } = validBody
    const res = await POST(makeRequest(rest))
    expect(res.status).toBe(400)
  })

  it('answer 미입력 시 400 반환', async () => {
    const { answer: _, ...rest } = validBody
    const res = await POST(makeRequest(rest))
    expect(res.status).toBe(400)
  })

  it('persona 미입력 시 400 반환', async () => {
    const { persona: _, ...rest } = validBody
    const res = await POST(makeRequest(rest))
    expect(res.status).toBe(400)
  })

  it('인증 없이 정상 호출 가능 (비로그인 허용)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockEvaluateResponse), { status: 200 })
    )

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
  })

  it('8축 scores + axisFeedbacks 반환', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockEvaluateResponse), { status: 200 })
    )

    const res = await POST(makeRequest(validBody))
    const data = await res.json()

    expect(data.scores).toBeDefined()
    expect(Object.keys(data.scores)).toHaveLength(8)
    expect(data.axisFeedbacks).toHaveLength(3)
    expect(data.totalScore).toBe(74)
    // usage는 제거됨
    expect(data.usage).toBeUndefined()
  })

  it('persona가 PERSONA_LABELS로 변환돼 엔진에 전달된다 (tech_lead → 기술팀장)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockEvaluateResponse), { status: 200 })
    )

    await POST(makeRequest(validBody))

    const [, options] = mockFetch.mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.history[0].personaLabel).toBe('기술팀장')
    expect(body.history[0].persona).toBe('tech_lead')
  })

  it('history가 5개로 패딩돼 엔진에 전달된다', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockEvaluateResponse), { status: 200 })
    )

    await POST(makeRequest(validBody))

    const [, options] = mockFetch.mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.history).toHaveLength(5)
    // 모두 같은 항목
    expect(body.history[0]).toEqual(body.history[4])
  })

  it('resumeText에 이력서 미제출 안내가 포함된다', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockEvaluateResponse), { status: 200 })
    )

    await POST(makeRequest(validBody))

    const [, options] = mockFetch.mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.resumeText).toContain('이력서 미제출')
  })

  it('엔진이 실패하면 502 반환', async () => {
    mockFetch.mockResolvedValueOnce(new Response('error', { status: 500 }))

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(502)
  })

  it('네트워크 오류 시 502 반환', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'))

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(502)
  })
})
