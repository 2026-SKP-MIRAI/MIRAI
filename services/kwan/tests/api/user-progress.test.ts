// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPrisma, mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockPrisma: {
    report: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { GET } from '@/app/api/user/progress/route'
import { NextRequest } from 'next/server'

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/user/progress')
}

const MOCK_SCORES = {
  communication: 85,
  problemSolving: 80,
  logicalThinking: 88,
  jobExpertise: 75,
  cultureFit: 82,
  leadership: 78,
  creativity: 83,
  sincerity: 90,
}

describe('GET /api/user/progress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
    })
    mockPrisma.report.findMany.mockResolvedValue([])
  })

  it('should return 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('로그인이 필요합니다.')
  })

  it('리포트 없음 → 200 + items: []', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
  })

  it('정상 흐름 → progress items with scores', async () => {
    mockPrisma.report.findMany.mockResolvedValueOnce([
      {
        sessionId: 'session-1',
        totalScore: 82,
        scores: MOCK_SCORES,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
      },
      {
        sessionId: 'session-2',
        totalScore: 88,
        scores: { ...MOCK_SCORES, communication: 90 },
        createdAt: new Date('2025-02-01T00:00:00.000Z'),
      },
    ])
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(2)
    expect(body.items[0].round).toBe(1)
    expect(body.items[0].totalScore).toBe(82)
    expect(body.items[0].scores.communication).toBe(85)
    expect(body.items[0].createdAt).toBe('2025-01-01T00:00:00.000Z')
    expect(body.items[1].round).toBe(2)
    expect(body.items[1].totalScore).toBe(88)
  })

  it('DB 오류 → 500', async () => {
    mockPrisma.report.findMany.mockRejectedValueOnce(new Error('DB connection failed'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('서버 오류가 발생했습니다.')
  })
})
