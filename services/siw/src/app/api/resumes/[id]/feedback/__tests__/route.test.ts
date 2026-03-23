import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/resume-repository', () => ({
  resumeRepository: { findDetailById: vi.fn() },
}))
vi.mock('@/lib/rag/embedding-client', () => ({
  embedText: vi.fn(),
}))
vi.mock('@/lib/rag/vector-search', () => ({
  searchSimilarPostings: vi.fn(),
  getTrendSkillsForRole: vi.fn(),
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
import { embedText } from '@/lib/rag/embedding-client'
import { searchSimilarPostings, getTrendSkillsForRole } from '@/lib/rag/vector-search'

describe('GET /api/resumes/[id]/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('ENABLE_RAG=false 시 trendComparison=null', async () => {
    vi.stubEnv('ENABLE_RAG', 'false')
    vi.mocked(resumeRepository.findDetailById).mockResolvedValue({
      id: '1',
      userId: 'user-1',
      fileName: 'cv.pdf',
      storageKey: 'key',
      resumeText: '자소서',
      questions: null,
      feedbackJson: null,
      inferredTargetRole: '백엔드',
      createdAt: new Date(),
    })
    const { GET } = await import('../route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: '1' }) })
    const data = await res.json()
    expect(data.trendComparison).toBeNull()
    expect(embedText).not.toHaveBeenCalled()
  })

  it('ENABLE_RAG=true + inferredTargetRole 없을 시 trendComparison=null', async () => {
    vi.stubEnv('ENABLE_RAG', 'true')
    vi.mocked(resumeRepository.findDetailById).mockResolvedValue({
      id: '1',
      userId: 'user-1',
      fileName: 'cv.pdf',
      storageKey: 'key',
      resumeText: '자소서',
      questions: null,
      feedbackJson: null,
      inferredTargetRole: null,
      createdAt: new Date(),
    })
    const { GET } = await import('../route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: '1' }) })
    const data = await res.json()
    expect(data.trendComparison).toBeNull()
  })

  it('ENABLE_RAG=true + 정상 경로 → FeedbackTrendComparison 반환', async () => {
    vi.stubEnv('ENABLE_RAG', 'true')
    vi.mocked(resumeRepository.findDetailById).mockResolvedValue({
      id: '1',
      userId: 'user-1',
      fileName: 'cv.pdf',
      storageKey: 'key',
      resumeText: '자소서',
      questions: null,
      feedbackJson: '{}',
      inferredTargetRole: '백엔드',
      createdAt: new Date(),
    })
    vi.mocked(embedText).mockResolvedValue({ vector: [0.1, 0.2], model: 'bge-m3', tokenCount: 10 })
    vi.mocked(getTrendSkillsForRole).mockResolvedValue(['Spring', 'Docker'])
    vi.mocked(searchSimilarPostings).mockResolvedValue([
      { title: 'T', company: 'C', similarity: 0.9, sourceUrl: 'http://x', jobRole: '백엔드' },
    ])
    const { GET } = await import('../route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: '1' }) })
    const data = await res.json()
    expect(data.trendComparison).not.toBeNull()
    expect(data.trendComparison.trendingSkills).toContain('Spring')
    expect(data.trendComparison.similarPostings).toHaveLength(1)
  })

  it('이력서 없을 시 404 반환', async () => {
    vi.mocked(resumeRepository.findDetailById).mockRejectedValue(new Error('Resume not found'))
    const { GET } = await import('../route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'no-exist' }) })
    expect(res.status).toBe(404)
  })
})
