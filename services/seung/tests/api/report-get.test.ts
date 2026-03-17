import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    report: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

import { GET } from '@/app/api/report/route'

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/report')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return { nextUrl: url } as unknown as NextRequest
}

const mockReport = {
  id: 'report-1',
  sessionId: 'session-1',
  totalScore: 79,
  scores: {
    communication: 80,
    problemSolving: 75,
    logicalThinking: 82,
    jobExpertise: 70,
    cultureFit: 85,
    leadership: 72,
    creativity: 78,
    sincerity: 88,
  },
  summary: '전반적으로 우수한 역량을 보여주었습니다.',
  axisFeedbacks: [
    {
      axis: 'communication',
      axisLabel: '의사소통',
      score: 80,
      type: 'strength',
      feedback: '명확한 의사소통 능력을 보여주었습니다.',
    },
  ],
  createdAt: new Date('2026-01-01T00:00:00Z'),
}

describe('GET /api/report', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reportId 있음 → 200 + ReportResponse', async () => {
    mockPrisma.report.findUnique.mockResolvedValueOnce(mockReport)

    const response = await GET(makeRequest({ reportId: 'report-1' }))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.id).toBe('report-1')
    expect(body.sessionId).toBe('session-1')
    expect(body.totalScore).toBe(79)
    expect(body.summary).toBe('전반적으로 우수한 역량을 보여주었습니다.')
    expect(body.axisFeedbacks).toHaveLength(1)
    expect(body.createdAt).toBeDefined()
  })

  it('reportId 없음 → 400', async () => {
    const response = await GET(makeRequest({}))
    expect(response.status).toBe(400)
    expect(mockPrisma.report.findUnique).not.toHaveBeenCalled()
  })

  it('리포트 없음 → 404', async () => {
    mockPrisma.report.findUnique.mockResolvedValueOnce(null)

    const response = await GET(makeRequest({ reportId: 'nonexistent' }))
    expect(response.status).toBe(404)
  })
})
