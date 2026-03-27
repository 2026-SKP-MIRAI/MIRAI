import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  })),
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}))
vi.mock('@/lib/resume-storage', () => ({
  uploadResumePdf: vi.fn().mockResolvedValue('storage/key.pdf'),
}))
vi.mock('@/lib/resume-repository', () => ({
  resumeRepository: {
    create: vi.fn().mockResolvedValue('resume-id-1'),
    listByUserId: vi.fn().mockResolvedValue([]),
  },
}))
vi.mock('@/lib/rag/embedding-client', () => ({
  embedText: vi.fn(),
  getEngineBaseUrl: vi.fn().mockReturnValue('http://localhost:3001'),
}))
vi.mock('@/lib/rag/vector-search', () => ({
  searchSimilarPostings: vi.fn().mockResolvedValue([]),
  extractTrendSkills: vi.fn().mockReturnValue([]),
}))
vi.mock('@/lib/rag/resume-search', () => ({
  searchSimilarAcceptedResumes: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/observability/event-logger', () => ({
  withEventLogging: vi.fn().mockImplementation((_event: string, _id: unknown, fn: (meta: { usage: unknown }) => unknown) => fn({ usage: null })),
}))

import { embedText } from '@/lib/rag/embedding-client'
import { searchSimilarPostings } from '@/lib/rag/vector-search'
import { searchSimilarAcceptedResumes } from '@/lib/rag/resume-search'

const MOCK_QUESTIONS_RESPONSE = { questions: ['질문1', '질문2'], usage: null }
const MOCK_FEEDBACK_RESPONSE = { scores: { overall: 80 }, suggestions: [], usage: null }

class MockPdfFile extends File {
  constructor() {
    super([Buffer.from('%PDF-1.4 mock')], 'resume.pdf', { type: 'application/pdf' })
  }
  async arrayBuffer(): Promise<ArrayBuffer> {
    return Buffer.from('%PDF-1.4 mock').buffer as ArrayBuffer
  }
}

function makeRequest(resumeText = '자소서 내용', targetRole = '백엔드') {
  const file = new MockPdfFile()
  const formData = new FormData()
  formData.append('file', file)
  formData.append('resumeText', resumeText)
  formData.append('targetRole', targetRole)

  // Mock request with formData() method to avoid Content-Type boundary issues in test env
  return {
    formData: vi.fn().mockResolvedValue(formData),
  } as unknown as Request
}

describe('POST /api/resumes — ENABLE_RESUME_RAG', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/resume/questions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MOCK_QUESTIONS_RESPONSE),
        })
      }
      if (url.includes('/api/resume/feedback')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MOCK_FEEDBACK_RESPONSE),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    }) as unknown as typeof fetch
  })

  it('ENABLE_RESUME_RAG=false → resume_context 미전달', async () => {
    vi.stubEnv('ENABLE_RAG', 'false')
    vi.stubEnv('ENABLE_RESUME_RAG', 'false')

    const { POST } = await import('../route')
    await POST(makeRequest())

    expect(embedText).not.toHaveBeenCalled()
    expect(searchSimilarAcceptedResumes).not.toHaveBeenCalled()

    const feedbackCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('/api/resume/feedback')
    )
    expect(feedbackCall).toBeDefined()
    const body = JSON.parse(feedbackCall![1].body)
    expect(body.resume_context).toBeUndefined()
  })

  it('ENABLE_RESUME_RAG=true + 임베딩 성공 → resume_context 전달', async () => {
    vi.stubEnv('ENABLE_RAG', 'false')
    vi.stubEnv('ENABLE_RESUME_RAG', 'true')

    vi.mocked(embedText).mockResolvedValue({ vector: [0.1, 0.2], model: 'bge-m3', tokenCount: 5 })
    vi.mocked(searchSimilarAcceptedResumes).mockResolvedValue([
      { id: 'r1', jobRole: '백엔드', content: '합격 예시 내용', similarity: 0.9 },
    ])

    const { POST } = await import('../route')
    await POST(makeRequest())

    const feedbackCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('/api/resume/feedback')
    )
    expect(feedbackCall).toBeDefined()
    const body = JSON.parse(feedbackCall![1].body)
    expect(body.resume_context).toEqual(['합격 예시 내용'])
  })

  it('ENABLE_RESUME_RAG=true + 임베딩 실패 → resume_context 없이 정상 요청', async () => {
    vi.stubEnv('ENABLE_RAG', 'false')
    vi.stubEnv('ENABLE_RESUME_RAG', 'true')

    vi.mocked(embedText).mockResolvedValue(null)

    const { POST } = await import('../route')
    const res = await POST(makeRequest())

    expect(searchSimilarAcceptedResumes).not.toHaveBeenCalled()
    expect(res.status).not.toBe(500)

    const feedbackCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('/api/resume/feedback')
    )
    expect(feedbackCall).toBeDefined()
    const body = JSON.parse(feedbackCall![1].body)
    expect(body.resume_context).toBeUndefined()
  })

  it('ENABLE_RAG=true + ENABLE_RESUME_RAG=true → 임베딩 1회만 호출', async () => {
    vi.stubEnv('ENABLE_RAG', 'true')
    vi.stubEnv('ENABLE_RESUME_RAG', 'true')

    vi.mocked(embedText).mockResolvedValue({ vector: [0.1, 0.2], model: 'bge-m3', tokenCount: 5 })
    vi.mocked(searchSimilarPostings).mockResolvedValue([])
    vi.mocked(searchSimilarAcceptedResumes).mockResolvedValue([])

    const { POST } = await import('../route')
    await POST(makeRequest())

    expect(embedText).toHaveBeenCalledOnce()
  })
})
