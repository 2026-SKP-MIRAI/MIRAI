import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Use vi.hoisted so mocks are available when vi.mock factory runs (hoisted)
const { mockPrisma, mockExtractPdfText } = vi.hoisted(() => ({
  mockPrisma: {
    resume: {
      create: vi.fn(),
    },
  },
  mockExtractPdfText: vi.fn().mockResolvedValue('extracted text'),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/pdf-utils', () => ({ extractPdfText: mockExtractPdfText }))

const mockFetch = vi.fn()
global.fetch = mockFetch

import { POST } from '@/app/api/resume/questions/route'

function makeRequest(formData?: FormData): NextRequest {
  const req = {
    formData: vi.fn().mockResolvedValue(formData ?? new FormData()),
  } as unknown as NextRequest
  return req
}

describe('POST /api/resume/questions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractPdfText.mockResolvedValue('extracted text')
    process.env.ENGINE_BASE_URL = 'http://localhost:8000'
  })

  it('파일 없으면 400 반환', async () => {
    const response = await POST(makeRequest())
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBeTruthy()
  })

  it('엔진 성공 응답(200) 그대로 전달', async () => {
    const mockData = {
      questions: [{ category: '직무 역량', question: '테스트 질문입니다.' }],
      meta: { extractedLength: 1000, categoriesUsed: ['직무 역량'] },
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockData,
    })
    mockPrisma.resume.create.mockResolvedValueOnce({ id: 'resume-1', diagnosisResult: null })

    const formData = new FormData()
    const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })
    formData.append('file', file)

    const response = await POST(makeRequest(formData))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.questions).toHaveLength(1)
    expect(body.questions[0].category).toBe('직무 역량')
  })

  it('엔진 400 에러 그대로 전달', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: '파일 오류' }),
    })

    const formData = new FormData()
    formData.append('file', new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }))

    const response = await POST(makeRequest(formData))
    expect(response.status).toBe(400)
  })

  it('엔진 422 에러 그대로 전달', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ detail: '빈 PDF' }),
    })

    const formData = new FormData()
    formData.append('file', new File([], 'empty.pdf', { type: 'application/pdf' }))

    const response = await POST(makeRequest(formData))
    expect(response.status).toBe(422)
  })

  it('엔진 500 에러 그대로 전달', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'LLM 오류' }),
    })

    const formData = new FormData()
    formData.append('file', new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }))

    const response = await POST(makeRequest(formData))
    expect(response.status).toBe(500)
  })

  it('fetch 자체 실패 시 500 반환', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'))

    const formData = new FormData()
    formData.append('file', new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }))

    const response = await POST(makeRequest(formData))
    expect(response.status).toBe(500)
  })

  // New tests for Phase 1

  it('성공 시 resumeId 반환', async () => {
    const mockData = {
      questions: [{ category: '직무 역량', question: '테스트' }],
      meta: { extractedLength: 500, categoriesUsed: ['직무 역량'] },
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockData,
    })
    mockPrisma.resume.create.mockResolvedValueOnce({ id: 'resume-abc', diagnosisResult: null })

    const formData = new FormData()
    formData.append('file', new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' }))

    const response = await POST(makeRequest(formData))
    const body = await response.json()
    expect(body.resumeId).toBe('resume-abc')
  })

  it('Prisma에 올바른 데이터로 저장', async () => {
    const mockQuestions = [{ category: '인성', question: '질문' }]
    const mockData = {
      questions: mockQuestions,
      meta: { extractedLength: 100, categoriesUsed: ['인성'] },
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockData,
    })
    mockPrisma.resume.create.mockResolvedValueOnce({ id: 'resume-xyz', diagnosisResult: null })

    const formData = new FormData()
    formData.append('file', new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' }))

    await POST(makeRequest(formData))

    expect(mockPrisma.resume.create).toHaveBeenCalledWith({
      data: {
        resumeText: 'extracted text',
        questions: mockQuestions,
      },
    })
  })

  it('빈 resumeText이면 DB 저장 건너뛰고 resumeId=null 반환', async () => {
    mockExtractPdfText.mockResolvedValueOnce('   ')
    const mockData = {
      questions: [{ category: '직무 역량', question: '테스트' }],
      meta: { extractedLength: 0, categoriesUsed: ['직무 역량'] },
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockData,
    })

    const formData = new FormData()
    formData.append('file', new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' }))

    const response = await POST(makeRequest(formData))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.resumeId).toBeNull()
    expect(mockPrisma.resume.create).not.toHaveBeenCalled()
  })

  it('DB 실패 시에도 엔진 결과 반환 (resumeId=null)', async () => {
    const mockData = {
      questions: [{ category: '직무 역량', question: '테스트' }],
      meta: { extractedLength: 500, categoriesUsed: ['직무 역량'] },
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockData,
    })
    mockPrisma.resume.create.mockRejectedValueOnce(new Error('DB error'))

    const formData = new FormData()
    formData.append('file', new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' }))

    const response = await POST(makeRequest(formData))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.resumeId).toBeNull()
    expect(body.questions).toHaveLength(1)
  })
})
