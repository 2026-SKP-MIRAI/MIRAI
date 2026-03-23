import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/resume-repository', () => ({
  resumeRepository: { findDetailById: vi.fn() },
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  })),
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}))

import { resumeRepository } from '@/lib/resume-repository'

const BASE_RESUME = {
  id: '1',
  userId: 'user-1',
  fileName: 'cv.pdf',
  storageKey: 'key',
  resumeText: '자소서',
  questions: null,
  createdAt: new Date(),
}

describe('GET /api/resumes/[id]/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('feedbackJson·trendComparison 모두 null → null 반환', async () => {
    vi.mocked(resumeRepository.findDetailById).mockResolvedValue({
      ...BASE_RESUME,
      feedbackJson: null,
      trendComparison: null,
      inferredTargetRole: null,
    })
    const { GET } = await import('../route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: '1' }) })
    const data = await res.json()
    expect(data.feedback).toBeNull()
    expect(data.trendComparison).toBeNull()
  })

  it('trendComparison DB에 TrendComparison 형태로 저장된 경우 그대로 반환', async () => {
    const storedTrend = {
      role: '백엔드',
      trendSkills: [
        { skill: 'Spring', weight: 0.8, inResume: true },
        { skill: 'Docker', weight: 0.6, inResume: false },
      ],
      coverageScore: 50,
    }
    vi.mocked(resumeRepository.findDetailById).mockResolvedValue({
      ...BASE_RESUME,
      feedbackJson: { scores: {}, strengths: [], weaknesses: [], suggestions: [] },
      trendComparison: storedTrend,
      inferredTargetRole: '백엔드',
    })
    const { GET } = await import('../route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: '1' }) })
    const data = await res.json()
    expect(data.trendComparison).not.toBeNull()
    expect(data.trendComparison.role).toBe('백엔드')
    expect(data.trendComparison.trendSkills).toHaveLength(2)
    expect(data.trendComparison.trendSkills[0].skill).toBe('Spring')
    expect(data.trendComparison.trendSkills[0].inResume).toBe(true)
    expect(data.trendComparison.coverageScore).toBe(50)
  })

  it('이력서 없을 시 404 반환', async () => {
    vi.mocked(resumeRepository.findDetailById).mockRejectedValue(new Error('Resume not found'))
    const { GET } = await import('../route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'no-exist' }) })
    expect(res.status).toBe(404)
  })
})
