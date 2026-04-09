// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPrisma, mockCreateClient, mockCookies } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockCookies: vi.fn(),
  mockPrisma: {
    resume: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('next/headers', () => ({ cookies: mockCookies }))

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
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
    })
    mockPrisma.resume.findUnique.mockResolvedValue({
      id: 'resume-1',
      userId: 'user-1',
      diagnosisResult: MOCK_DIAGNOSIS,
    })
    mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) })
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

  it('should return 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })
    const res = await GET(makeRequest('resume-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('로그인이 필요합니다.')
  })

  it('should return 403 when accessing other user data', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce({
      id: 'resume-1',
      userId: 'other-user',
      diagnosisResult: MOCK_DIAGNOSIS,
    })
    const res = await GET(makeRequest('resume-1'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('접근 권한이 없습니다.')
  })
})
