// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCallEngineParse, mockCallEngineQuestions, mockPrisma } = vi.hoisted(() => ({
  mockCallEngineParse: vi.fn(),
  mockCallEngineQuestions: vi.fn(),
  mockPrisma: {
    resume: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/engine-client', () => ({
  callEngineParse: mockCallEngineParse,
  callEngineQuestions: mockCallEngineQuestions,
}))

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

import { POST } from '@/app/api/resume/questions/route'

function makeMockResponse(ok: boolean, status: number, data: unknown): Response {
  return {
    ok,
    status,
    json: async () => data,
  } as unknown as Response
}

function makeRequest(file?: File): Request {
  const formData = new FormData()
  if (file) formData.append('file', file)
  return {
    formData: () => Promise.resolve(formData),
  } as unknown as Request
}

function makePdfFile(name = 'resume.pdf') {
  return new File(['%PDF-1.4 test'], name, { type: 'application/pdf' })
}

const DEFAULT_QUESTIONS = [
  { category: '직무 역량', question: '테스트 질문입니다.' },
]
const DEFAULT_META = { extractedLength: 1000, categoriesUsed: ['직무 역량'] }

describe('POST /api/resume/questions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallEngineParse.mockResolvedValue(
      makeMockResponse(true, 200, { resumeText: '안녕하세요. 저는 소프트웨어 엔지니어입니다.', extractedLength: 100 })
    )
    mockCallEngineQuestions.mockResolvedValue(
      makeMockResponse(true, 200, { questions: DEFAULT_QUESTIONS, meta: DEFAULT_META })
    )
    mockPrisma.resume.create.mockResolvedValue({ id: 'resume-1' })
  })

  it('파일 없음 → 400', async () => {
    const req = makeRequest()
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('PDF 파일을 선택해주세요.')
  })

  it('/parse 네트워크 오류 → 500', async () => {
    mockCallEngineParse.mockRejectedValueOnce(new Error('network error'))
    const res = await POST(makeRequest(makePdfFile()))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('서버 오류')
  })

  it('/parse JSON 파싱 실패 → 500', async () => {
    mockCallEngineParse.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => { throw new Error('invalid json') },
    } as unknown as Response)
    const res = await POST(makeRequest(makePdfFile()))
    expect(res.status).toBe(500)
  })

  it('/parse 400 에러 → { error } 형식으로 전달', async () => {
    mockCallEngineParse.mockResolvedValueOnce(
      makeMockResponse(false, 400, { detail: '파일 크기가 5MB를 초과합니다.' })
    )
    const res = await POST(makeRequest(makePdfFile()))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('파일 크기가 5MB를 초과합니다.')
  })

  it('/parse 422 에러 → { error } 형식으로 전달', async () => {
    mockCallEngineParse.mockResolvedValueOnce(
      makeMockResponse(false, 422, { detail: '이미지로만 구성된 PDF입니다.' })
    )
    const res = await POST(makeRequest(makePdfFile()))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('이미지로만 구성된 PDF입니다.')
  })

  it('/parse 성공이지만 resumeText 누락 → 500', async () => {
    mockCallEngineParse.mockResolvedValueOnce(
      makeMockResponse(true, 200, { extractedLength: 100 })
    )
    const res = await POST(makeRequest(makePdfFile()))
    expect(res.status).toBe(500)
  })

  it('/parse 성공이지만 resumeText 공백 → 500', async () => {
    mockCallEngineParse.mockResolvedValueOnce(
      makeMockResponse(true, 200, { resumeText: '   ', extractedLength: 0 })
    )
    const res = await POST(makeRequest(makePdfFile()))
    expect(res.status).toBe(500)
  })

  it('정상 흐름 → 200 + questions + resumeId', async () => {
    const res = await POST(makeRequest(makePdfFile()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.questions).toHaveLength(1)
    expect(body.questions[0].category).toBe('직무 역량')
    expect(body.meta.extractedLength).toBe(1000)
    expect(body.resumeId).toBe('resume-1')
    expect(mockPrisma.resume.create).toHaveBeenCalledTimes(1)
  })

  it('/questions 에러 → 에러 전달', async () => {
    mockCallEngineQuestions.mockResolvedValueOnce(
      makeMockResponse(false, 500, { detail: 'LLM 오류' })
    )
    const res = await POST(makeRequest(makePdfFile()))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('LLM 오류')
  })

  it('/questions 네트워크 오류 → 500', async () => {
    mockCallEngineQuestions.mockRejectedValueOnce(new Error('timeout'))
    const res = await POST(makeRequest(makePdfFile()))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('서버 오류')
  })

  it('DB 저장 실패 → 200 + resumeId: null', async () => {
    mockPrisma.resume.create.mockRejectedValueOnce(new Error('DB connection failed'))
    const res = await POST(makeRequest(makePdfFile()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.questions).toHaveLength(1)
    expect(body.resumeId).toBeNull()
  })

  it('/parse 타임아웃 → 타임아웃 메시지', async () => {
    const timeoutError = new Error('timeout')
    timeoutError.name = 'TimeoutError'
    mockCallEngineParse.mockRejectedValueOnce(timeoutError)
    const res = await POST(makeRequest(makePdfFile()))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('요청 시간이 초과됐습니다. 잠시 후 다시 시도해주세요.')
  })

  it('/questions 타임아웃 → 타임아웃 메시지', async () => {
    const timeoutError = new Error('timeout')
    timeoutError.name = 'AbortError'
    mockCallEngineQuestions.mockRejectedValueOnce(timeoutError)
    const res = await POST(makeRequest(makePdfFile()))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('요청 시간이 초과됐습니다. 잠시 후 다시 시도해주세요.')
  })

  it('/questions JSON 파싱 실패 → 500', async () => {
    mockCallEngineQuestions.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => { throw new Error('invalid json') },
    } as unknown as Response)
    const res = await POST(makeRequest(makePdfFile()))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('서버 오류')
  })

  it('Zod 검증 실패 (questions 형식 불일치) → 500', async () => {
    mockCallEngineQuestions.mockResolvedValueOnce(
      makeMockResponse(true, 200, { questions: 'not-an-array', meta: DEFAULT_META })
    )
    const res = await POST(makeRequest(makePdfFile()))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('서버 오류')
  })
})
