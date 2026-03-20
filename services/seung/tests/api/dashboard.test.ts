import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPrisma, mockCreateClient } = vi.hoisted(() => ({
  mockPrisma: {
    resume: { findMany: vi.fn() },
  },
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { GET } from '@/app/api/dashboard/route'

const mockResumes = [
  {
    id: 'resume-1',
    userId: 'user-1',
    fileName: 'backend_resume.pdf',
    resumeText: '저는 백엔드 개발자로서 3년간 Java와 Spring Boot를 사용하여 대규모 트래픽 서비스를 개발해왔습니다.',
    questions: [],
    diagnosisResult: { scores: { specificity: 80 } },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    sessions: [
      {
        id: 'session-1',
        report: { id: 'report-1' },
      },
    ],
  },
  {
    id: 'resume-2',
    userId: 'user-1',
    resumeText: '프론트엔드 개발자로 React와 TypeScript 경험이 있습니다.',
    questions: [],
    diagnosisResult: null,
    createdAt: new Date('2026-01-02T00:00:00Z'),
    sessions: [],
  },
]

describe('GET /api/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
    })
  })

  it('resume 목록 반환 → 200 + resumes 배열', async () => {
    mockPrisma.resume.findMany.mockResolvedValueOnce(mockResumes)

    const response = await GET()
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.resumes).toHaveLength(2)

    expect(body.resumes[0].id).toBe('resume-1')
    expect(body.resumes[0].sessionCount).toBe(1)
    expect(body.resumes[0].hasReport).toBe(true)
    expect(body.resumes[0].reportId).toBe('report-1')
    expect(body.resumes[0].hasDiagnosis).toBe(true)
    expect(body.resumes[0].createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(body.resumes[0].fileName).toBe('backend_resume.pdf')

    expect(body.resumes[1].id).toBe('resume-2')
    expect(body.resumes[1].sessionCount).toBe(0)
    expect(body.resumes[1].hasReport).toBe(false)
    expect(body.resumes[1].reportId).toBeNull()
    expect(body.resumes[1].hasDiagnosis).toBe(false)
    // fileName null → 폴백 문자열 생성 확인
    expect(body.resumes[1].fileName).toMatch(/^자소서/)
  })

  it('미인증 → 401', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })

    const response = await GET()
    expect(response.status).toBe(401)
    expect(mockPrisma.resume.findMany).not.toHaveBeenCalled()
  })

  it('resume 없을 때 → 200 + 빈 배열', async () => {
    mockPrisma.resume.findMany.mockResolvedValueOnce([])

    const response = await GET()
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.resumes).toHaveLength(0)
  })

  it('DB 에러 → 500', async () => {
    mockPrisma.resume.findMany.mockRejectedValueOnce(new Error('DB connection error'))

    const response = await GET()
    expect(response.status).toBe(500)
  })
})
