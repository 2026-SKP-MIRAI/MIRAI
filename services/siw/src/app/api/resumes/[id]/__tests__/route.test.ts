import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/resume-repository', () => ({
  resumeRepository: {
    findById: vi.fn(),
    deleteById: vi.fn(),
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  })),
  createServiceClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  })),
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}))

import { resumeRepository } from '@/lib/resume-repository'

const BASE_RESUME = {
  id: 'resume-1',
  userId: 'user-1',
  fileName: 'cv.pdf',
  storageKey: 'resumes/user-1/cv.pdf',
  resumeText: '자소서',
  questions: null,
  feedbackJson: null,
  trendComparison: null,
  inferredTargetRole: null,
  createdAt: new Date(),
}

describe('DELETE /api/resumes/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SUPABASE_STORAGE_BUCKET = 'test-bucket'
  })

  it('401 - 미인증 요청', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')
    vi.mocked(createServerClient).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never)

    const { DELETE } = await import('../route')
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'resume-1' }),
    })
    expect(res.status).toBe(401)
  })

  it('404 - 존재하지 않는 이력서', async () => {
    vi.mocked(resumeRepository.findById).mockRejectedValue(new Error('Not found'))

    const { DELETE } = await import('../route')
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'no-exist' }),
    })
    expect(res.status).toBe(404)
  })

  it('403 - 타인 이력서 삭제 시도', async () => {
    vi.mocked(resumeRepository.findById).mockResolvedValue({
      ...BASE_RESUME,
      userId: 'other-user',
    })

    const { DELETE } = await import('../route')
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'resume-1' }),
    })
    expect(res.status).toBe(403)
  })

  it('200 - 본인 이력서 삭제 성공', async () => {
    vi.mocked(resumeRepository.findById).mockResolvedValue(BASE_RESUME)
    vi.mocked(resumeRepository.deleteById).mockResolvedValue(true)

    const { DELETE } = await import('../route')
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'resume-1' }),
    })
    expect(res.status).toBe(200)
    expect(resumeRepository.deleteById).toHaveBeenCalledWith('resume-1', 'user-1')
  })
})
