// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import mockEngineResponse from '../fixtures/input/mock_engine_response.json'
import errorResponses from '../fixtures/input/error_responses.json'

vi.mock('@/lib/engine-client', () => ({
  callEngineQuestions: vi.fn(),
}))

vi.mock('pdf-parse', () => ({
  PDFParse: vi.fn().mockImplementation(function () {
    return {
      getText: vi.fn().mockResolvedValue({ text: '안녕하세요. 저는 소프트웨어 엔지니어입니다.' }),
    }
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    resume: {
      create: vi.fn(),
    },
  },
}))

import { POST } from '@/app/api/resume/questions/route'
import { callEngineQuestions } from '@/lib/engine-client'
import { prisma } from '@/lib/db'
import { PDFParse } from 'pdf-parse'

const mockCallEngine = vi.mocked(callEngineQuestions)
const mockPDFParse = vi.mocked(PDFParse)

function makePdfFile(name = 'resume.pdf') {
  return new File(['%PDF-1.4 test'], name, { type: 'application/pdf' })
}

function makeRequest(file?: File): Request {
  const formData = new FormData()
  if (file) formData.append('file', file)
  return {
    formData: () => Promise.resolve(formData),
  } as unknown as Request
}

describe('POST /api/resume/questions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPDFParse.mockImplementation(function () {
      return {
        getText: vi.fn().mockResolvedValue({ text: '안녕하세요. 저는 소프트웨어 엔지니어입니다.' }),
      }
    })
    vi.mocked(prisma.resume.create).mockResolvedValue({ id: 'test-resume-id-123' } as ReturnType<typeof prisma.resume.create> extends Promise<infer T> ? T : never)
  })

  it('파일 없음 → 400 한국어 에러', async () => {
    const req = makeRequest()
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('PDF 파일을 선택해주세요.')
  })

  it('정상 PDF → 200 + fixture questions 반환 + resumeId 포함', async () => {
    mockCallEngine.mockResolvedValueOnce(
      new Response(JSON.stringify(mockEngineResponse), { status: 200 })
    )
    const req = makeRequest(makePdfFile())
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.questions).toHaveLength(mockEngineResponse.questions.length)
    expect(body.meta.extractedLength).toBe(mockEngineResponse.meta.extractedLength)
    expect(body.resumeId).toBe('test-resume-id-123')
    expect(vi.mocked(prisma.resume.create)).toHaveBeenCalledTimes(1)
  })

  it('DB INSERT 실패 → 500 반환', async () => {
    mockCallEngine.mockResolvedValueOnce(
      new Response(JSON.stringify(mockEngineResponse), { status: 200 })
    )
    vi.mocked(prisma.resume.create).mockRejectedValueOnce(new Error('DB connection failed'))
    const req = makeRequest(makePdfFile())
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('서버 오류')
  })

  it('엔진 400 (파일 크기 초과) → 400 + 한국어 메시지 전달', async () => {
    const { status, body } = errorResponses.tooLarge
    mockCallEngine.mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status })
    )
    const req = makeRequest(makePdfFile())
    const res = await POST(req)
    expect(res.status).toBe(400)
    const resBody = await res.json()
    expect(resBody.error).toBe(body.detail)
    expect(vi.mocked(prisma.resume.create)).not.toHaveBeenCalled()
  })

  it('엔진 422 (이미지 전용 PDF) → 422 + 한국어 메시지 전달', async () => {
    const { status, body } = errorResponses.imageOnlyPdf
    mockCallEngine.mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status })
    )
    const req = makeRequest(makePdfFile())
    const res = await POST(req)
    expect(res.status).toBe(422)
    const resBody = await res.json()
    expect(resBody.error).toBe(body.detail)
    expect(vi.mocked(prisma.resume.create)).not.toHaveBeenCalled()
  })

  it('엔진 500 (LLM 오류) → 500 + 한국어 메시지 전달', async () => {
    const { status, body } = errorResponses.llmError
    mockCallEngine.mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status })
    )
    const req = makeRequest(makePdfFile())
    const res = await POST(req)
    expect(res.status).toBe(500)
    const resBody = await res.json()
    expect(resBody.error).toBe(body.detail)
    expect(vi.mocked(prisma.resume.create)).not.toHaveBeenCalled()
  })

  it('네트워크 오류(타임아웃·엔진 다운) → 500 한국어 메시지', async () => {
    mockCallEngine.mockRejectedValueOnce(new Error('fetch failed'))
    const req = makeRequest(makePdfFile())
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
  })

  it('빈 resumeText (이미지 전용 PDF 등) → 200 + resumeId: null', async () => {
    mockPDFParse.mockImplementationOnce(function () {
      return { getText: vi.fn().mockResolvedValue({ text: '' }) }
    })
    mockCallEngine.mockResolvedValueOnce(
      new Response(JSON.stringify(mockEngineResponse), { status: 200 })
    )
    const req = makeRequest(makePdfFile())
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.resumeId).toBeNull()
    expect(vi.mocked(prisma.resume.create)).not.toHaveBeenCalled()
  })
})
