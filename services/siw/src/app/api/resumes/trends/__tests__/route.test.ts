import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/rag/embedding-client', () => ({
  embedText: vi.fn(),
  fetchTrendSkills: vi.fn(),
}))
vi.mock('@/lib/rag/vector-search', () => ({
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

import { embedText } from '@/lib/rag/embedding-client'
import { getTrendSkillsForRole } from '@/lib/rag/vector-search'

describe('Trends API RAG', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('ENABLE_RAG=false 시 getTrendSkillsForRole 미호출', async () => {
    vi.stubEnv('ENABLE_RAG', 'false')
    const { GET } = await import('../route')
    const req = new Request('http://localhost/api/resumes/trends?role=백엔드')
    await GET(req)
    expect(getTrendSkillsForRole).not.toHaveBeenCalled()
  })

  it('ENABLE_RAG=true + embedText null 반환 시 getTrendSkillsForRole 미호출', async () => {
    vi.stubEnv('ENABLE_RAG', 'true')
    vi.mocked(embedText).mockResolvedValue(null)
    const { GET } = await import('../route')
    const req = new Request('http://localhost/api/resumes/trends?role=백엔드')
    await GET(req)
    expect(getTrendSkillsForRole).not.toHaveBeenCalled()
  })

  it('ENABLE_RAG=true + embedText 정상 반환 시 getTrendSkillsForRole 호출', async () => {
    vi.stubEnv('ENABLE_RAG', 'true')
    vi.mocked(embedText).mockResolvedValue({ vector: [0.1, 0.2], model: 'bge-m3', tokenCount: 5 })
    vi.mocked(getTrendSkillsForRole).mockResolvedValue(['Java', 'Spring'])
    const { GET } = await import('../route')
    const req = new Request('http://localhost/api/resumes/trends?role=백엔드')
    const res = await GET(req)
    const data = await res.json()
    expect(getTrendSkillsForRole).toHaveBeenCalled()
    expect(data.skills).toContain('Java')
    expect(data.enabled).toBe(true)
  })
})
