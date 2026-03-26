import { describe, it, expect, vi, beforeEach } from 'vitest'

// prisma mock
vi.mock('@/lib/prisma', () => ({
  prisma: {
    demoUsage: {
      upsert: vi.fn(),
    },
  },
}))

// fetch mock
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { prisma } from '@/lib/prisma'
import { POST } from '../question/route'

const mockUpsert = vi.mocked(prisma.demoUsage.upsert)

function makeRequest(body: object, ip = '1.2.3.4') {
  return new Request('http://localhost/api/demo/question', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  })
}

const mockEngineQuestion = {
  firstQuestion: { question: '자기소개를 해주세요.', persona: 'tech_lead' },
}

function mockEngineOk() {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify(mockEngineQuestion), { status: 200 })
  )
}

describe('POST /api/demo/question', () => {
  beforeEach(() => {
    mockUpsert.mockReset()
    mockFetch.mockReset()
  })

  it('targetRole 미입력 시 400 반환', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('같은 IP 같은 날 1회 — 200 + question 반환 (remaining=2)', async () => {
    mockUpsert.mockResolvedValueOnce({ count: 1 })
    mockEngineOk()

    const res = await POST(makeRequest({ targetRole: '프론트엔드 개발자' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.question).toBe('자기소개를 해주세요.')
    expect(data.persona).toBe('tech_lead')
    expect(data.remainingToday).toBe(2)
  })

  it('같은 IP 같은 날 2회 — 200 + remaining=1', async () => {
    mockUpsert.mockResolvedValueOnce({ count: 2 })
    mockEngineOk()

    const res = await POST(makeRequest({ targetRole: '백엔드 개발자' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.remainingToday).toBe(1)
  })

  it('같은 IP 같은 날 3회 — 200 + remaining=0', async () => {
    mockUpsert.mockResolvedValueOnce({ count: 3 })
    mockEngineOk()

    const res = await POST(makeRequest({ targetRole: '기획자(PM)' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.remainingToday).toBe(0)
  })

  it('같은 IP 같은 날 4회 — 429 + resetAt 반환', async () => {
    mockUpsert.mockResolvedValueOnce({ count: 4 })

    const res = await POST(makeRequest({ targetRole: '디자이너' }))
    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.message).toBeTruthy()
    expect(data.resetAt).toBeTruthy()
    // 엔진 호출 없음
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('다른 IP 같은 날 — 200 (remaining=2)', async () => {
    mockUpsert.mockResolvedValueOnce({ count: 1 })
    mockEngineOk()

    const res = await POST(makeRequest({ targetRole: '마케터' }, '9.8.7.6'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.remainingToday).toBe(2)
  })

  it('같은 IP 다른 날 — 200 (count=1, remaining=2)', async () => {
    // upsert는 날짜가 다르면 count=1로 create
    mockUpsert.mockResolvedValueOnce({ count: 1 })
    mockEngineOk()

    const res = await POST(makeRequest({ targetRole: '데이터 분석가' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.remainingToday).toBe(2)
  })

  it('엔진 오류 시 502 반환', async () => {
    mockUpsert.mockResolvedValueOnce({ count: 1 })
    mockFetch.mockResolvedValueOnce(new Response('error', { status: 500 }))

    const res = await POST(makeRequest({ targetRole: '프론트엔드 개발자' }))
    expect(res.status).toBe(502)
  })

  it('엔진 호출에 tech_lead 페르소나가 전달된다', async () => {
    mockUpsert.mockResolvedValueOnce({ count: 1 })
    mockEngineOk()

    await POST(makeRequest({ targetRole: '프론트엔드 개발자' }))

    const [, options] = mockFetch.mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.personas).toEqual(['tech_lead'])
  })

  it('resumeText에 이력서 미제출 안내가 포함된다', async () => {
    mockUpsert.mockResolvedValueOnce({ count: 1 })
    mockEngineOk()

    await POST(makeRequest({ targetRole: '백엔드 개발자' }))

    const [, options] = mockFetch.mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.resumeText).toContain('이력서 미제출')
  })
})
