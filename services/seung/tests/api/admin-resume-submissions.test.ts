import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockPrisma, mockCreateClient } = vi.hoisted(() => ({
  mockPrisma: {
    resumeSubmission: {
      findMany: vi.fn(),
      delete: vi.fn(),
    },
  },
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { GET, DELETE } from '@/app/api/admin/resume-submissions/route'

const ADMIN_EMAIL = 'admin@test.com'

function makeRequest(path: string, params: Record<string, string> = {}): NextRequest {
  const url = new URL(`http://localhost${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return { nextUrl: url } as unknown as NextRequest
}

function mockAdmin() {
  process.env.ADMIN_EMAIL = ADMIN_EMAIL
  mockCreateClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1', email: ADMIN_EMAIL } } }) },
  })
}

describe('GET /api/admin/resume-submissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ADMIN_EMAIL = ADMIN_EMAIL
  })

  it('미로그인 시 401 반환', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })
    const res = await GET(makeRequest('/api/admin/resume-submissions'))
    expect(res.status).toBe(401)
  })

  it('비관리자 시 403 반환', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'other@test.com' } } }) },
    })
    const res = await GET(makeRequest('/api/admin/resume-submissions'))
    expect(res.status).toBe(403)
  })

  it('이메일 대소문자 무관하게 관리자 인증', async () => {
    process.env.ADMIN_EMAIL = 'Admin@Test.com'
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'a1', email: 'admin@test.com' } } }) },
    })
    mockPrisma.resumeSubmission.findMany.mockResolvedValueOnce([])
    const res = await GET(makeRequest('/api/admin/resume-submissions'))
    expect(res.status).toBe(200)
  })

  it('정상 조회 시 200 + submissions 반환', async () => {
    mockAdmin()
    const rows = [{ id: 1, userId: 'u1', jobRole: '백엔드', company: null, processed: false, createdAt: new Date().toISOString() }]
    mockPrisma.resumeSubmission.findMany.mockResolvedValueOnce(rows)
    const res = await GET(makeRequest('/api/admin/resume-submissions'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.submissions).toHaveLength(1)
  })

  it('processed=false 필터 적용', async () => {
    mockAdmin()
    mockPrisma.resumeSubmission.findMany.mockResolvedValueOnce([])
    await GET(makeRequest('/api/admin/resume-submissions', { processed: 'false' }))
    expect(mockPrisma.resumeSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { processed: false } })
    )
  })

  it('page=abc 시 1페이지로 폴백', async () => {
    mockAdmin()
    mockPrisma.resumeSubmission.findMany.mockResolvedValueOnce([])
    await GET(makeRequest('/api/admin/resume-submissions', { page: 'abc' }))
    expect(mockPrisma.resumeSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 })
    )
  })
})

describe('DELETE /api/admin/resume-submissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdmin()
  })

  it('id 없으면 400 반환', async () => {
    const res = await DELETE(makeRequest('/api/admin/resume-submissions'))
    expect(res.status).toBe(400)
  })

  it('정상 삭제 시 204 반환', async () => {
    mockPrisma.resumeSubmission.delete.mockResolvedValueOnce({})
    const res = await DELETE(makeRequest('/api/admin/resume-submissions', { id: '1' }))
    expect(res.status).toBe(204)
  })

  it('존재하지 않는 id 삭제 시 404 반환', async () => {
    const p2025 = Object.assign(new Error('not found'), { code: 'P2025' })
    mockPrisma.resumeSubmission.delete.mockRejectedValueOnce(p2025)
    const res = await DELETE(makeRequest('/api/admin/resume-submissions', { id: '999' }))
    expect(res.status).toBe(404)
  })

  it('DB 오류 시 500 반환', async () => {
    mockPrisma.resumeSubmission.delete.mockRejectedValueOnce(new Error('DB error'))
    const res = await DELETE(makeRequest('/api/admin/resume-submissions', { id: '1' }))
    expect(res.status).toBe(500)
  })
})
