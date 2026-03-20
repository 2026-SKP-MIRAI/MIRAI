import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockPrisma, mockCallEngineParse, mockCallEngineQuestions, mockCreateClient } = vi.hoisted(() => ({
  mockPrisma: {
    resume: {
      create: vi.fn(),
    },
  },
  mockCallEngineParse: vi.fn(),
  mockCallEngineQuestions: vi.fn(),
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/engine-client', () => ({
  callEngineParse: mockCallEngineParse,
  callEngineQuestions: mockCallEngineQuestions,
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { POST } from '@/app/api/resume/questions/route'

function makeRequest(formData?: FormData): NextRequest {
  const req = {
    formData: vi.fn().mockResolvedValue(formData ?? new FormData()),
  } as unknown as NextRequest
  return req
}

function makeMockResponse(ok: boolean, status: number, data: unknown): Response {
  return {
    ok,
    status,
    json: async () => data,
  } as unknown as Response
}

const DEFAULT_QUESTIONS = [{ category: '직무 역량', question: '테스트 질문입니다.' }]
const DEFAULT_META = { extractedLength: 1000, categoriesUsed: ['직무 역량'] }

describe('POST /api/resume/questions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENGINE_BASE_URL = 'http://localhost:8000'
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    })
    mockCallEngineParse.mockResolvedValue(
      makeMockResponse(true, 200, { resumeText: 'extracted text', extractedLength: 100 })
    )
    mockCallEngineQuestions.mockResolvedValue(
      makeMockResponse(true, 200, { questions: DEFAULT_QUESTIONS, meta: DEFAULT_META })
    )
    mockPrisma.resume.create.mockResolvedValue({ id: 'resume-1' })
  })

  it('파일 없으면 400 반환', async () => {
    const response = await POST(makeRequest())
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBeTruthy()
  })

  it('ENGINE_BASE_URL 없으면 500 반환', async () => {
    delete process.env.ENGINE_BASE_URL
    const formData = new FormData()
    formData.append('file', new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }))
    const response = await POST(makeRequest(formData))
    expect(response.status).toBe(500)
  })

  it('/parse 네트워크 오류 → 500', async () => {
    mockCallEngineParse.mockRejectedValueOnce(new Error('network error'))
    const formData = new FormData()
    formData.append('file', new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }))
    const response = await POST(makeRequest(formData))
    expect(response.status).toBe(500)
  })

  it('/parse 성공이지만 resumeText 누락 시 500 반환', async () => {
    mockCallEngineParse.mockResolvedValueOnce(
      makeMockResponse(true, 200, { extractedLength: 100 })
    )
    const formData = new FormData()
    formData.append('file', new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }))
    const response = await POST(makeRequest(formData))
    expect(response.status).toBe(500)
  })

  it('/parse 성공이지만 resumeText 공백만 있을 시 500 반환', async () => {
    mockCallEngineParse.mockResolvedValueOnce(
      makeMockResponse(true, 200, { resumeText: '   ', extractedLength: 0 })
    )
    const formData = new FormData()
    formData.append('file', new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }))
    const response = await POST(makeRequest(formData))
    expect(response.status).toBe(500)
  })

  it('/parse 400 에러 그대로 전달', async () => {
    mockCallEngineParse.mockResolvedValueOnce(
      makeMockResponse(false, 400, { detail: '파일 오류' })
    )
    const formData = new FormData()
    formData.append('file', new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }))
    const response = await POST(makeRequest(formData))
    expect(response.status).toBe(400)
  })

  it('/parse 422 에러 그대로 전달', async () => {
    mockCallEngineParse.mockResolvedValueOnce(
      makeMockResponse(false, 422, { detail: '빈 PDF' })
    )
    const formData = new FormData()
    formData.append('file', new File([], 'empty.pdf', { type: 'application/pdf' }))
    const response = await POST(makeRequest(formData))
    expect(response.status).toBe(422)
  })

  it('/questions 400 에러 그대로 전달', async () => {
    mockCallEngineQuestions.mockResolvedValueOnce(
      makeMockResponse(false, 400, { detail: '잘못된 요청' })
    )
    const formData = new FormData()
    formData.append('file', new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }))
    const response = await POST(makeRequest(formData))
    expect(response.status).toBe(400)
  })

  it('/questions 422 에러 그대로 전달', async () => {
    mockCallEngineQuestions.mockResolvedValueOnce(
      makeMockResponse(false, 422, { detail: '빈 텍스트' })
    )
    const formData = new FormData()
    formData.append('file', new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }))
    const response = await POST(makeRequest(formData))
    expect(response.status).toBe(422)
  })

  it('/questions 500 에러 그대로 전달', async () => {
    mockCallEngineQuestions.mockResolvedValueOnce(
      makeMockResponse(false, 500, { detail: 'LLM 오류' })
    )
    const formData = new FormData()
    formData.append('file', new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }))
    const response = await POST(makeRequest(formData))
    expect(response.status).toBe(500)
  })

  it('성공 시 questions 반환', async () => {
    const formData = new FormData()
    formData.append('file', new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' }))
    const response = await POST(makeRequest(formData))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.questions).toHaveLength(1)
    expect(body.questions[0].category).toBe('직무 역량')
  })

  it('성공 시 resumeId 반환', async () => {
    mockPrisma.resume.create.mockResolvedValueOnce({ id: 'resume-abc' })
    const formData = new FormData()
    formData.append('file', new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' }))
    const response = await POST(makeRequest(formData))
    const body = await response.json()
    expect(body.resumeId).toBe('resume-abc')
  })

  it('Prisma에 resumeText와 questions:[]로 저장', async () => {
    const formData = new FormData()
    formData.append('file', new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' }))
    await POST(makeRequest(formData))
    expect(mockPrisma.resume.create).toHaveBeenCalledWith({
      data: {
        resumeText: 'extracted text',
        questions: [],
        userId: 'user-1',
        fileName: 'resume.pdf',
      },
    })
  })

  it('미인증 시 401 반환', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })
    const formData = new FormData()
    formData.append('file', new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' }))
    const response = await POST(makeRequest(formData))
    expect(response.status).toBe(401)
    expect(mockCallEngineParse).not.toHaveBeenCalled()
  })

  it('DB 실패 시에도 엔진 결과 반환 (resumeId=null)', async () => {
    mockPrisma.resume.create.mockRejectedValueOnce(new Error('DB error'))
    const formData = new FormData()
    formData.append('file', new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' }))
    const response = await POST(makeRequest(formData))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.resumeId).toBeNull()
    expect(body.questions).toHaveLength(1)
  })

  it('/questions 응답에 questions 배열 없으면 502', async () => {
    mockCallEngineQuestions.mockResolvedValueOnce(
      makeMockResponse(true, 200, { unexpected: 'shape' })
    )
    const formData = new FormData()
    formData.append('file', new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }))
    const response = await POST(makeRequest(formData))
    expect(response.status).toBe(502)
  })
})
