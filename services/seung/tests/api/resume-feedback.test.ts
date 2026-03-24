import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockPrisma, mockCreateClient } = vi.hoisted(() => ({
  mockPrisma: {
    resume: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

const mockFetch = vi.fn()
global.fetch = mockFetch

import { POST } from '@/app/api/resume/feedback/route'

function makeRequest(body?: object): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body ?? {}),
  } as unknown as NextRequest
}

const mockEngineResult = {
  scores: {
    specificity: 72,
    achievementClarity: 65,
    logicStructure: 80,
    roleAlignment: 88,
    differentiation: 60,
  },
  strengths: ['논리 구조가 명확함', '직무 적합성 높음'],
  weaknesses: ['수치 근거 부족', '차별성 낮음'],
  suggestions: [
    { section: '성장 경험', issue: '수치 없음', suggestion: '구체적 수치 추가 권장' },
  ],
}

describe('POST /api/resume/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENGINE_BASE_URL = 'http://localhost:8000'
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    })
  })

  it('resumeId 없으면 400 반환', async () => {
    const res = await POST(makeRequest({ targetRole: '백엔드 개발자' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('targetRole 없으면 400 반환', async () => {
    const res = await POST(makeRequest({ resumeId: 'resume-1' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('targetRole 빈 문자열이면 400 반환', async () => {
    const res = await POST(makeRequest({ resumeId: 'resume-1', targetRole: '   ' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('Resume 없으면 404 반환', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce(null)
    const res = await POST(makeRequest({ resumeId: 'not-exist', targetRole: '백엔드' }))
    expect(res.status).toBe(404)
  })

  it('미인증 시 401 반환', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })
    const res = await POST(makeRequest({ resumeId: 'resume-1', targetRole: '백엔드' }))
    expect(res.status).toBe(401)
    expect(mockPrisma.resume.findUnique).not.toHaveBeenCalled()
  })

  it('타인 resume 접근 시 403 반환', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce({
      id: 'resume-1',
      userId: 'other-user',
      resumeText: '자소서',
      diagnosisResult: null,
    })
    const res = await POST(makeRequest({ resumeId: 'resume-1', targetRole: '백엔드' }))
    expect(res.status).toBe(403)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('엔진 성공 시 200 + ResumeFeedbackResponse 반환', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce({
      id: 'resume-1',
      userId: 'user-1',
      resumeText: '자소서 내용',
      diagnosisResult: null,
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockEngineResult,
    })
    mockPrisma.resume.update.mockResolvedValueOnce({})

    const res = await POST(makeRequest({ resumeId: 'resume-1', targetRole: '백엔드 개발자' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.scores.specificity).toBe(72)
    expect(body.strengths).toHaveLength(2)
    expect(body.suggestions).toHaveLength(1)
  })

  it('성공 시 prisma.resume.update로 diagnosisResult 저장', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce({
      id: 'resume-1',
      userId: 'user-1',
      resumeText: '자소서 내용',
      diagnosisResult: null,
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockEngineResult,
    })
    mockPrisma.resume.update.mockResolvedValueOnce({})

    await POST(makeRequest({ resumeId: 'resume-1', targetRole: '백엔드 개발자' }))

    expect(mockPrisma.resume.update).toHaveBeenCalledWith({
      where: { id: 'resume-1' },
      data: { diagnosisResult: mockEngineResult },
    })
  })

  it('엔진에 resumeText와 targetRole을 전달', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce({
      id: 'resume-1',
      userId: 'user-1',
      resumeText: '자소서 내용 전문',
      diagnosisResult: null,
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockEngineResult,
    })
    mockPrisma.resume.update.mockResolvedValueOnce({})

    await POST(makeRequest({ resumeId: 'resume-1', targetRole: '프론트엔드' }))

    const fetchCall = mockFetch.mock.calls[0]
    expect(fetchCall[0]).toContain('/api/resume/feedback')
    const fetchBody = JSON.parse(fetchCall[1].body)
    expect(fetchBody.resumeText).toBe('자소서 내용 전문')
    expect(fetchBody.targetRole).toBe('프론트엔드')
  })

  it('AbortSignal.timeout(40000)으로 엔진 호출', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce({
      id: 'resume-1',
      userId: 'user-1',
      resumeText: '자소서',
      diagnosisResult: null,
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockEngineResult,
    })
    mockPrisma.resume.update.mockResolvedValueOnce({})

    await POST(makeRequest({ resumeId: 'resume-1', targetRole: '개발자' }))

    const fetchOptions = mockFetch.mock.calls[0][1]
    expect(fetchOptions.signal).toBeDefined()
  })

  it('엔진 400 에러 그대로 전달', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce({
      id: 'resume-1',
      userId: 'user-1',
      resumeText: '자소서',
      diagnosisResult: null,
    })
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: '잘못된 요청' }),
    })

    const res = await POST(makeRequest({ resumeId: 'resume-1', targetRole: '개발자' }))
    expect(res.status).toBe(400)
  })

  it('엔진 500 에러 그대로 전달', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce({
      id: 'resume-1',
      userId: 'user-1',
      resumeText: '자소서',
      diagnosisResult: null,
    })
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'LLM 오류' }),
    })

    const res = await POST(makeRequest({ resumeId: 'resume-1', targetRole: '개발자' }))
    expect(res.status).toBe(500)
  })

  it('fetch 자체 실패 시 500 반환', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce({
      id: 'resume-1',
      userId: 'user-1',
      resumeText: '자소서',
      diagnosisResult: null,
    })
    mockFetch.mockRejectedValueOnce(new Error('network error'))

    const res = await POST(makeRequest({ resumeId: 'resume-1', targetRole: '개발자' }))
    expect(res.status).toBe(500)
  })
})
