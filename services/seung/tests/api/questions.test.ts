import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/resume/questions/route'

const mockFetch = vi.fn()
global.fetch = mockFetch

function makeRequest(formData?: FormData): NextRequest {
  const req = {
    formData: vi.fn().mockResolvedValue(formData ?? new FormData()),
  } as unknown as NextRequest
  return req
}

describe('POST /api/resume/questions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
