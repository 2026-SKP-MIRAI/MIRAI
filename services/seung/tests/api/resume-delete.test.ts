import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockPrisma, mockCreateClient } = vi.hoisted(() => ({
  mockPrisma: {
    resume: { findUnique: vi.fn(), delete: vi.fn() },
    report: { deleteMany: vi.fn() },
    interviewSession: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { DELETE } from '@/app/api/resume/[id]/route'

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

const mockResume = { id: 'resume-1', userId: 'user-1' }

describe('DELETE /api/resume/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    })
    mockPrisma.$transaction.mockResolvedValue([])
  })

  it('정상 삭제 → 204', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce(mockResume)

    const response = await DELETE({} as NextRequest, makeParams('resume-1'))
    expect(response.status).toBe(204)
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce()
  })

  it('미인증 → 401', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })

    const response = await DELETE({} as NextRequest, makeParams('resume-1'))
    expect(response.status).toBe(401)
    expect(mockPrisma.resume.findUnique).not.toHaveBeenCalled()
  })

  it('존재하지 않는 resume → 404', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce(null)

    const response = await DELETE({} as NextRequest, makeParams('nonexistent'))
    expect(response.status).toBe(404)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('타인 resume 삭제 시도 → 403', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce({ ...mockResume, userId: 'other-user' })

    const response = await DELETE({} as NextRequest, makeParams('resume-1'))
    expect(response.status).toBe(403)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('DB 에러 → 500', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce(mockResume)
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('DB error'))

    const response = await DELETE({} as NextRequest, makeParams('resume-1'))
    expect(response.status).toBe(500)
  })
})
