// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPrisma, mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockPrisma: {
    resume: { findUnique: vi.fn(), delete: vi.fn() },
    interviewSession: { deleteMany: vi.fn() },
    report: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { DELETE } from '@/app/api/resume/[id]/route'
import { NextRequest } from 'next/server'

function makeRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost/api/resume/${id}`, { method: 'DELETE' })
  return [req, { params: Promise.resolve({ id }) }]
}

describe('DELETE /api/resume/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
    })
    mockPrisma.resume.findUnique.mockResolvedValue({
      id: 'resume-1',
      userId: 'user-1',
    })
    mockPrisma.$transaction.mockResolvedValue([])
  })

  it('should return 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })
    const res = await DELETE(...makeRequest('resume-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('로그인이 필요합니다.')
  })

  it('should return 403 when resume belongs to another user', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce({
      id: 'resume-1',
      userId: 'other-user',
    })
    const res = await DELETE(...makeRequest('resume-1'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('접근 권한이 없습니다.')
  })

  it('should return 404 when resume not found', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce(null)
    const res = await DELETE(...makeRequest('non-existent'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('자소서를 찾을 수 없습니다.')
  })

  it('정상 삭제 → 204 (cascade: reports -> sessions -> resume)', async () => {
    const res = await DELETE(...makeRequest('resume-1'))
    expect(res.status).toBe(204)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it('DB findUnique 실패 → 500', async () => {
    mockPrisma.resume.findUnique.mockRejectedValueOnce(new Error('DB connection failed'))
    const res = await DELETE(...makeRequest('resume-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('서버 오류가 발생했습니다.')
  })

  it('DB $transaction 실패 → 500', async () => {
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('transaction failed'))
    const res = await DELETE(...makeRequest('resume-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('서버 오류가 발생했습니다.')
  })
})
