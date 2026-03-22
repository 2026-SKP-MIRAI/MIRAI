// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    report: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

import { GET } from '@/app/api/report/route'

function makeRequest(reportId?: string): Request {
  const url = reportId
    ? `http://localhost/api/report?reportId=${reportId}`
    : 'http://localhost/api/report'
  return { url } as unknown as Request
}

const MOCK_REPORT = {
  id: 'report-1',
  sessionId: 'session-1',
  totalScore: 82,
  scores: { communication: 85, problemSolving: 80, logicalThinking: 88, jobExpertise: 75, cultureFit: 82, leadership: 78, creativity: 83, sincerity: 90 },
  summary: '전반적으로 우수한 면접 능력을 보여주었습니다.',
  axisFeedbacks: [{ axis: 'communication', axisLabel: '의사소통', score: 85, type: 'strength', feedback: '명확하고 논리적인 표현이 돋보였습니다.' }],
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
}

describe('GET /api/report', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.report.findUnique.mockResolvedValue(MOCK_REPORT)
  })

  it('reportId 누락 → 400', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('reportId가 필요합니다.')
  })

  it('report 없음 → 404', async () => {
    mockPrisma.report.findUnique.mockResolvedValueOnce(null)
    const res = await GET(makeRequest('non-existent'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('리포트를 찾을 수 없습니다.')
  })

  it('정상 흐름 → 200 + 리포트 전체 데이터', async () => {
    const res = await GET(makeRequest('report-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('report-1')
    expect(body.totalScore).toBe(82)
    expect(body.scores.communication).toBe(85)
    expect(body.summary).toBeTruthy()
    expect(body.axisFeedbacks).toHaveLength(1)
    expect(body.createdAt).toBe('2025-01-01T00:00:00.000Z')
  })

  it('DB 오류 → 500', async () => {
    mockPrisma.report.findUnique.mockRejectedValueOnce(new Error('DB connection failed'))
    const res = await GET(makeRequest('report-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })
})
