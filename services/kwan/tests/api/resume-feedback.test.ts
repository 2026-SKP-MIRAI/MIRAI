// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCallEngineResumeFeedback, mockPrisma } = vi.hoisted(() => ({
  mockCallEngineResumeFeedback: vi.fn(),
  mockPrisma: {
    resume: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('@/lib/engine-client', () => ({ callEngineResumeFeedback: mockCallEngineResumeFeedback }))
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

import { POST } from '@/app/api/resume/feedback/route'

function makeMockResponse(ok: boolean, status: number, data: unknown): Response {
  return { ok, status, json: async () => data } as unknown as Response
}

const DEFAULT_FEEDBACK = {
  scores: {
    specificity: 80,
    achievementClarity: 75,
    logicStructure: 85,
    roleAlignment: 70,
    differentiation: 65,
  },
  strengths: ['명확한 성과 기술', '구체적인 기술 스택 언급'],
  weaknesses: ['차별화 포인트 부족'],
  suggestions: [
    { section: '자기소개', issue: '너무 일반적', suggestion: '구체적인 프로젝트 언급' },
  ],
}

const MOCK_RESUME = {
  id: 'resume-1',
  resumeText: '안녕하세요. 백엔드 엔지니어입니다.',
  inferredTargetRole: '백엔드 엔지니어',
}

describe('POST /api/resume/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.resume.findUnique.mockResolvedValue(MOCK_RESUME)
    mockCallEngineResumeFeedback.mockResolvedValue(
      makeMockResponse(true, 200, DEFAULT_FEEDBACK)
    )
    mockPrisma.resume.update.mockResolvedValue({})
  })

  it('resumeId 누락 → 400', async () => {
    const req = { json: async () => ({}) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('resumeId가 필요합니다.')
  })

  it('resume 없음 → 404', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce(null)
    const req = { json: async () => ({ resumeId: 'non-existent' }) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('자소서를 찾을 수 없습니다.')
  })

  it('정상 흐름 (targetRole 제공) → 200 + 엔진 응답 반환', async () => {
    const req = {
      json: async () => ({ resumeId: 'resume-1', targetRole: '프론트엔드 엔지니어' }),
    } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.scores.specificity).toBe(80)
    expect(body.strengths).toHaveLength(2)
    expect(body.suggestions).toHaveLength(1)
    expect(mockCallEngineResumeFeedback).toHaveBeenCalledWith(
      MOCK_RESUME.resumeText,
      '프론트엔드 엔지니어'
    )
  })

  it('targetRole 미제공 → inferredTargetRole 사용', async () => {
    const req = {
      json: async () => ({ resumeId: 'resume-1' }),
    } as unknown as Request
    await POST(req)
    expect(mockCallEngineResumeFeedback).toHaveBeenCalledWith(
      MOCK_RESUME.resumeText,
      '백엔드 엔지니어'
    )
  })

  it('targetRole 미제공 + inferredTargetRole 없음 → "미지정 직무" 사용', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce({
      ...MOCK_RESUME,
      inferredTargetRole: null,
    })
    const req = {
      json: async () => ({ resumeId: 'resume-1' }),
    } as unknown as Request
    await POST(req)
    expect(mockCallEngineResumeFeedback).toHaveBeenCalledWith(
      MOCK_RESUME.resumeText,
      '미지정 직무'
    )
  })

  it('엔진 오류 → 500', async () => {
    mockCallEngineResumeFeedback.mockRejectedValueOnce(new Error('network error'))
    const req = {
      json: async () => ({ resumeId: 'resume-1' }),
    } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('서버 오류가 발생했습니다.')
  })

  it('타임아웃 → 500 + 타임아웃 메시지', async () => {
    const timeoutError = new Error('timeout')
    timeoutError.name = 'TimeoutError'
    mockCallEngineResumeFeedback.mockRejectedValueOnce(timeoutError)
    const req = {
      json: async () => ({ resumeId: 'resume-1' }),
    } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('요청 시간이 초과됐습니다. 잠시 후 다시 시도해주세요.')
  })

  it('DB update 실패 → 200 (결과는 반환)', async () => {
    mockPrisma.resume.update.mockRejectedValueOnce(new Error('DB error'))
    const req = {
      json: async () => ({ resumeId: 'resume-1' }),
    } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.scores.specificity).toBe(80)
  })

  it('Zod 검증 실패 → 500', async () => {
    mockCallEngineResumeFeedback.mockResolvedValueOnce(
      makeMockResponse(true, 200, { scores: 'invalid', strengths: [], weaknesses: [], suggestions: [] })
    )
    const req = {
      json: async () => ({ resumeId: 'resume-1' }),
    } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it('DB lookup 실패 → 500', async () => {
    mockPrisma.resume.findUnique.mockRejectedValueOnce(new Error('DB connection failed'))
    const req = {
      json: async () => ({ resumeId: 'resume-1' }),
    } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })
})
