// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    resume: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

import { GET } from '@/app/api/resume/diagnosis/route'

function makeRequest(resumeId?: string): Request {
  const url = resumeId
    ? `http://localhost/api/resume/diagnosis?resumeId=${resumeId}`
    : 'http://localhost/api/resume/diagnosis'
  return { url } as unknown as Request
}

const MOCK_DIAGNOSIS = {
  scores: { specificity: 80, achievementClarity: 75, logicStructure: 85, roleAlignment: 70, differentiation: 65 },
  strengths: ['강점1'],
  weaknesses: ['약점1'],
  suggestions: [{ section: '자기소개', issue: '문제', suggestion: '제안' }],
}

describe('GET /api/resume/diagnosis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.resume.findUnique.mockResolvedValue({
      id: 'resume-1',
      diagnosisResult: MOCK_DIAGNOSIS,
    })
  })

  it('resumeId 누락 → 400', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('resumeId가 필요합니다.')
  })

  it('resume 없음 → 404', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce(null)
    const res = await GET(makeRequest('non-existent'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('자소서를 찾을 수 없습니다.')
  })

  it('diagnosisResult 없음 → 404', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce({ id: 'resume-1', diagnosisResult: null })
    const res = await GET(makeRequest('resume-1'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('진단 결과가 없습니다.')
  })

  it('정상 흐름 → 200 + diagnosisResult', async () => {
    const res = await GET(makeRequest('resume-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.scores.specificity).toBe(80)
    expect(body.strengths).toHaveLength(1)
  })

  it('DB 오류 → 500', async () => {
    mockPrisma.resume.findUnique.mockRejectedValueOnce(new Error('DB connection failed'))
    const res = await GET(makeRequest('resume-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })
})
