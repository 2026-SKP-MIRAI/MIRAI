import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockPrisma,
  mockCreateClient,
  mockCallEngineFeedback,
  mockEmbedText,
  mockSearchSimilarAcceptedResumes,
} = vi.hoisted(() => ({
  mockPrisma: {
    resume: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  mockCreateClient: vi.fn(),
  mockCallEngineFeedback: vi.fn(),
  mockEmbedText: vi.fn(),
  mockSearchSimilarAcceptedResumes: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('@/lib/engine-client', () => ({ callEngineFeedback: mockCallEngineFeedback }))
vi.mock('@/lib/rag/embedding-client', () => ({ embedText: mockEmbedText }))
vi.mock('@/lib/rag/resume-search', () => ({ searchSimilarAcceptedResumes: mockSearchSimilarAcceptedResumes }))

import { POST } from '@/app/api/resume/feedback/route'

function makeRequest(body?: object): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body ?? {}),
  } as unknown as NextRequest
}

function makeMockResponse(ok: boolean, status: number, data: unknown): Response {
  return {
    ok,
    status,
    json: async () => data,
  } as unknown as Response
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

const mockResume = {
  id: 'resume-1',
  userId: 'user-1',
  resumeText: '자소서 내용',
  diagnosisResult: null,
}

describe('POST /api/resume/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ENABLE_RAG
    process.env.ENGINE_BASE_URL = 'http://localhost:8000'
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    })
    mockCallEngineFeedback.mockResolvedValue(makeMockResponse(true, 200, mockEngineResult))
    mockPrisma.resume.findUnique.mockResolvedValue(mockResume)
    mockPrisma.resume.update.mockResolvedValue({})
    mockEmbedText.mockResolvedValue(null)
    mockSearchSimilarAcceptedResumes.mockResolvedValue([])
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
      ...mockResume,
      userId: 'other-user',
    })
    const res = await POST(makeRequest({ resumeId: 'resume-1', targetRole: '백엔드' }))
    expect(res.status).toBe(403)
    expect(mockCallEngineFeedback).not.toHaveBeenCalled()
  })

  it('엔진 성공 시 200 + ResumeFeedbackResponse 반환', async () => {
    const res = await POST(makeRequest({ resumeId: 'resume-1', targetRole: '백엔드 개발자' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.scores.specificity).toBe(72)
    expect(body.strengths).toHaveLength(2)
    expect(body.suggestions).toHaveLength(1)
  })

  it('성공 시 prisma.resume.update로 diagnosisResult 저장', async () => {
    await POST(makeRequest({ resumeId: 'resume-1', targetRole: '백엔드 개발자' }))
    expect(mockPrisma.resume.update).toHaveBeenCalledWith({
      where: { id: 'resume-1' },
      data: { diagnosisResult: mockEngineResult },
    })
  })

  it('엔진에 resumeText와 targetRole을 전달', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce({
      ...mockResume,
      resumeText: '자소서 내용 전문',
    })
    await POST(makeRequest({ resumeId: 'resume-1', targetRole: '프론트엔드' }))
    expect(mockCallEngineFeedback).toHaveBeenCalledWith('자소서 내용 전문', '프론트엔드')
  })

  it('엔진 400 에러 그대로 전달', async () => {
    mockCallEngineFeedback.mockResolvedValueOnce(
      makeMockResponse(false, 400, { detail: '잘못된 요청' })
    )
    const res = await POST(makeRequest({ resumeId: 'resume-1', targetRole: '개발자' }))
    expect(res.status).toBe(400)
  })

  it('엔진 500 에러 그대로 전달', async () => {
    mockCallEngineFeedback.mockResolvedValueOnce(
      makeMockResponse(false, 500, { detail: 'LLM 오류' })
    )
    const res = await POST(makeRequest({ resumeId: 'resume-1', targetRole: '개발자' }))
    expect(res.status).toBe(500)
  })

  it('엔진 호출 자체 실패 시 500 반환', async () => {
    mockCallEngineFeedback.mockRejectedValueOnce(new Error('network error'))
    const res = await POST(makeRequest({ resumeId: 'resume-1', targetRole: '개발자' }))
    expect(res.status).toBe(500)
  })

  it('엔진 TimeoutError 시 504 반환', async () => {
    const timeoutError = new DOMException('timeout', 'TimeoutError')
    mockCallEngineFeedback.mockRejectedValueOnce(timeoutError)
    const res = await POST(makeRequest({ resumeId: 'resume-1', targetRole: '개발자' }))
    expect(res.status).toBe(504)
    const body = await res.json()
    expect(body.error).toContain('지연')
  })

  // RAG 테스트 케이스
  describe('RAG 파이프라인', () => {
    beforeEach(() => {
      process.env.RAG_DATABASE_URL = 'postgresql://rag-db'
    })

    afterEach(() => {
      delete process.env.RAG_DATABASE_URL
    })

    it('ENABLE_RAG=false 시 embedText 미호출, callEngineFeedback에 resume_context 미전달', async () => {
      await POST(makeRequest({ resumeId: 'resume-1', targetRole: '백엔드 개발자' }))
      expect(mockEmbedText).not.toHaveBeenCalled()
      expect(mockCallEngineFeedback).toHaveBeenCalledWith('자소서 내용', '백엔드 개발자')
    })

    it('RAG_DATABASE_URL 미설정 시 ENABLE_RAG=true여도 embedText 미호출', async () => {
      delete process.env.RAG_DATABASE_URL
      process.env.ENABLE_RAG = 'true'
      await POST(makeRequest({ resumeId: 'resume-1', targetRole: '백엔드 개발자' }))
      expect(mockEmbedText).not.toHaveBeenCalled()
      expect(mockCallEngineFeedback).toHaveBeenCalledWith('자소서 내용', '백엔드 개발자')
    })

    it('ENABLE_RAG=true + 임베딩 성공 시 resume_context 전달', async () => {
      process.env.ENABLE_RAG = 'true'
      mockEmbedText.mockResolvedValueOnce({ vector: [0.1, 0.2], model: 'bge-m3' })
      mockSearchSimilarAcceptedResumes.mockResolvedValueOnce([
        { id: '1', jobRole: '백엔드 개발자', content: '합격 자소서 A', similarity: 0.9 },
        { id: '2', jobRole: '백엔드 개발자', content: '합격 자소서 B', similarity: 0.85 },
      ])
      await POST(makeRequest({ resumeId: 'resume-1', targetRole: '백엔드 개발자' }))
      expect(mockCallEngineFeedback).toHaveBeenCalledWith(
        '자소서 내용',
        '백엔드 개발자',
        ['합격 자소서 A', '합격 자소서 B']
      )
    })

    it('ENABLE_RAG=true + 임베딩 null 반환 시 graceful degradation, 200 반환', async () => {
      process.env.ENABLE_RAG = 'true'
      mockEmbedText.mockResolvedValueOnce(null)
      const res = await POST(makeRequest({ resumeId: 'resume-1', targetRole: '백엔드 개발자' }))
      expect(res.status).toBe(200)
      expect(mockCallEngineFeedback).toHaveBeenCalledWith('자소서 내용', '백엔드 개발자')
    })

    it('ENABLE_RAG=true + 검색 결과 0건 시 resume_context 미전달', async () => {
      process.env.ENABLE_RAG = 'true'
      mockEmbedText.mockResolvedValueOnce({ vector: [0.1, 0.2], model: 'bge-m3' })
      mockSearchSimilarAcceptedResumes.mockResolvedValueOnce([])
      await POST(makeRequest({ resumeId: 'resume-1', targetRole: '백엔드 개발자' }))
      expect(mockCallEngineFeedback).toHaveBeenCalledWith('자소서 내용', '백엔드 개발자')
    })

    it('ENABLE_RAG=true + 검색 throw 시 graceful degradation, 200 반환', async () => {
      process.env.ENABLE_RAG = 'true'
      mockEmbedText.mockResolvedValueOnce({ vector: [0.1, 0.2], model: 'bge-m3' })
      mockSearchSimilarAcceptedResumes.mockRejectedValueOnce(new Error('DB error'))
      const res = await POST(makeRequest({ resumeId: 'resume-1', targetRole: '백엔드 개발자' }))
      expect(res.status).toBe(200)
      expect(mockCallEngineFeedback).toHaveBeenCalledWith('자소서 내용', '백엔드 개발자')
    })
  })
})
