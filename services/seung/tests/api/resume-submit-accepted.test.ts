import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockPrisma, mockCreateClient, mockCallEngineAnalyze, mockRateLimit } = vi.hoisted(() => ({
  mockPrisma: {
    resumeSubmission: {
      create: vi.fn(),
      count: vi.fn(),
    },
  },
  mockCreateClient: vi.fn(),
  mockCallEngineAnalyze: vi.fn(),
  mockRateLimit: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('@/lib/engine-client', () => ({ callEngineAnalyze: mockCallEngineAnalyze }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mockRateLimit }))

import { GET, POST } from '@/app/api/resume/submit-accepted/route'

const VALID_TEXT = 'A'.repeat(200)

function makeFormDataRequest(fields: Record<string, string | File | undefined>): NextRequest {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) formData.append(key, value)
  }
  return { formData: () => Promise.resolve(formData) } as unknown as NextRequest
}

function mockAnalyzeSuccess(text = VALID_TEXT) {
  mockCallEngineAnalyze.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ resumeText: text }),
  })
}

describe('GET /api/resume/submit-accepted', () => {
  beforeEach(() => vi.clearAllMocks())

  it('전체 제출 건수 반환', async () => {
    mockPrisma.resumeSubmission.count.mockResolvedValueOnce(42)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(42)
  })

  it('DB 오류 시 500 반환', async () => {
    mockPrisma.resumeSubmission.count.mockRejectedValueOnce(new Error('DB error'))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe('POST /api/resume/submit-accepted', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENGINE_BASE_URL = 'http://engine'
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    })
    mockRateLimit.mockReturnValue(true)
  })

  it('rate limit 초과 시 429 반환', async () => {
    mockRateLimit.mockReturnValueOnce(3600)
    const res = await POST(makeFormDataRequest({ jobRole: '백엔드 개발자', file: new File(['x'], 'r.pdf', { type: 'application/pdf' }), consent: 'true' }))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('3600')
    expect(mockCallEngineAnalyze).not.toHaveBeenCalled()
  })

  it('미로그인 시 401 반환', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })
    const res = await POST(makeFormDataRequest({ jobRole: '백엔드 개발자', file: new File(['x'], 'r.pdf', { type: 'application/pdf' }), consent: 'true' }))
    expect(res.status).toBe(401)
    expect(mockCallEngineAnalyze).not.toHaveBeenCalled()
  })

  it('jobRole 없으면 400 반환', async () => {
    const res = await POST(makeFormDataRequest({ file: new File(['x'], 'r.pdf', { type: 'application/pdf' }), consent: 'true' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/직군/)
  })

  it('파일 없으면 400 반환', async () => {
    const res = await POST(makeFormDataRequest({ jobRole: '백엔드 개발자', consent: 'true' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/PDF/)
  })

  it('consent 없으면 400 반환', async () => {
    const res = await POST(makeFormDataRequest({ jobRole: '백엔드 개발자', file: new File(['x'], 'r.pdf', { type: 'application/pdf' }) }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/동의/)
  })

  it('추출 텍스트 200자 미만이면 400 반환', async () => {
    mockCallEngineAnalyze.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ resumeText: 'A'.repeat(199) }),
    })
    const res = await POST(makeFormDataRequest({ jobRole: '백엔드 개발자', file: new File(['x'], 'r.pdf', { type: 'application/pdf' }), consent: 'true' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/200자/)
  })

  it('정상 제출 시 201 + id/createdAt 반환', async () => {
    mockAnalyzeSuccess()
    const now = new Date().toISOString()
    mockPrisma.resumeSubmission.create.mockResolvedValueOnce({ id: 1, createdAt: now })
    const res = await POST(makeFormDataRequest({
      jobRole: '백엔드 개발자',
      file: new File(['x'], 'r.pdf', { type: 'application/pdf' }),
      company: '카카오',
      consent: 'true',
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe(1)
    expect(mockPrisma.resumeSubmission.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', jobRole: '백엔드 개발자', content: VALID_TEXT, company: '카카오' },
      select: { id: true, createdAt: true },
    })
  })

  it('DB 오류 시 500 반환', async () => {
    mockAnalyzeSuccess()
    mockPrisma.resumeSubmission.create.mockRejectedValueOnce(new Error('DB error'))
    const res = await POST(makeFormDataRequest({ jobRole: '백엔드 개발자', file: new File(['x'], 'r.pdf', { type: 'application/pdf' }), consent: 'true' }))
    expect(res.status).toBe(500)
  })
})
