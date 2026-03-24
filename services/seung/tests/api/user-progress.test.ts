import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockPrisma, mockCreateClient } = vi.hoisted(() => ({
  mockPrisma: {
    report: { findMany: vi.fn() },
  },
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { GET } from '@/app/api/user/progress/route'

function makeRequest(): NextRequest {
  return { nextUrl: new URL('http://localhost/api/user/progress') } as unknown as NextRequest
}

const mockReports = [
  {
    sessionId: 'session-1',
    totalScore: 70,
    scores: { communication: 70, problemSolving: 70, logicalThinking: 70, jobExpertise: 70, cultureFit: 70, leadership: 70, creativity: 70, sincerity: 70 },
    createdAt: new Date('2026-01-01T00:00:00Z'),
  },
  {
    sessionId: 'session-2',
    totalScore: 85,
    scores: { communication: 85, problemSolving: 85, logicalThinking: 85, jobExpertise: 85, cultureFit: 85, leadership: 85, creativity: 85, sincerity: 85 },
    createdAt: new Date('2026-01-02T00:00:00Z'),
  },
]

describe('GET /api/user/progress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    })
  })

  it('리포트 없는 유저 → { items: [] } (200)', async () => {
    mockPrisma.report.findMany.mockResolvedValueOnce([])

    const response = await GET(makeRequest())
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.items).toEqual([])
  })

  it('리포트 2개 → round 1, 2 오름차순 정렬', async () => {
    mockPrisma.report.findMany.mockResolvedValueOnce(mockReports)

    const response = await GET(makeRequest())
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.items).toHaveLength(2)
    expect(body.items[0].round).toBe(1)
    expect(body.items[0].sessionId).toBe('session-1')
    expect(body.items[0].totalScore).toBe(70)
    expect(body.items[1].round).toBe(2)
    expect(body.items[1].sessionId).toBe('session-2')
    expect(body.items[1].totalScore).toBe(85)
  })

  it('미인증 → 401', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })

    const response = await GET(makeRequest())
    expect(response.status).toBe(401)
    expect(mockPrisma.report.findMany).not.toHaveBeenCalled()
  })

  it('DB 오류 → 500', async () => {
    mockPrisma.report.findMany.mockRejectedValueOnce(new Error('DB error'))

    const response = await GET(makeRequest())
    expect(response.status).toBe(500)
  })
})
