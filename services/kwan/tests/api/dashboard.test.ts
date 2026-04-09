// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPrisma, mockCreateClient, mockCookies } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockCookies: vi.fn(),
  mockPrisma: {
    resume: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('next/headers', () => ({ cookies: mockCookies }))

import { GET } from '@/app/api/dashboard/route'

const NOW = new Date('2025-06-01T00:00:00.000Z')

function makeResumeWithSessions(overrides: Record<string, unknown> = {}) {
  return {
    id: 'resume-1',
    createdAt: NOW,
    fileName: 'test.pdf',
    diagnosisResult: { scores: {} },
    sessions: [
      {
        id: 'session-1',
        sessionComplete: true,
        updatedAt: NOW,
        report: { id: 'report-1', createdAt: NOW },
      },
      {
        id: 'session-2',
        sessionComplete: false,
        updatedAt: new Date('2025-06-02T00:00:00.000Z'),
        report: null,
      },
    ],
    ...overrides,
  }
}

describe('GET /api/dashboard', () => {
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
    mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) })
    mockPrisma.resume.findMany.mockResolvedValue([])
  })

  it('should return 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })
    mockCookies.mockResolvedValueOnce({ get: vi.fn().mockReturnValue(undefined) })
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('로그인이 필요합니다.')
  })

  it('비회원 모드(__guest=1) → 200 + resumes: []', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })
    mockCookies.mockResolvedValueOnce({ get: vi.fn().mockReturnValue({ value: '1' }) })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.resumes).toEqual([])
  })

  it('빈 배열 → 200 + resumes: []', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.resumes).toEqual([])
  })

  it('정상 흐름 → resume 목록 + session/report 데이터', async () => {
    mockPrisma.resume.findMany.mockResolvedValueOnce([makeResumeWithSessions()])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.resumes).toHaveLength(1)
    const resume = body.resumes[0]
    expect(resume.id).toBe('resume-1')
    expect(resume.fileName).toBe('test.pdf')
    expect(resume.sessionCount).toBe(2)
    expect(resume.hasReport).toBe(true)
    expect(resume.reportId).toBe('report-1')
    expect(resume.hasDiagnosis).toBe(true)
    expect(resume.inProgressSessionId).toBe('session-2')
    expect(resume.reports).toHaveLength(1)
    expect(resume.reports[0].id).toBe('report-1')
  })

  it('fileName 없음 → 기본 이름 사용', async () => {
    mockPrisma.resume.findMany.mockResolvedValueOnce([
      makeResumeWithSessions({ fileName: null, sessions: [] }),
    ])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.resumes[0].fileName).toContain('자소서')
  })

  it('DB 오류 → 500', async () => {
    mockPrisma.resume.findMany.mockRejectedValueOnce(new Error('DB connection failed'))
    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('서버 오류가 발생했습니다.')
  })
})
