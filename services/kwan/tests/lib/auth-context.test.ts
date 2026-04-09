// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreateClient, mockCookies } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockCookies: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('next/headers', () => ({ cookies: mockCookies }))

import { getAuthContext } from '@/lib/auth-context'

describe('getAuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('로그인 사용자 → user, userId, isGuest=false 반환', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    })

    const ctx = await getAuthContext()

    expect(ctx.user).toEqual({ id: 'user-1' })
    expect(ctx.userId).toBe('user-1')
    expect(ctx.isGuest).toBe(false)
    expect(mockCookies).not.toHaveBeenCalled()
  })

  it('미인증 + __guest 쿠키 없음 → user=null, isGuest=false', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })
    mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) })

    const ctx = await getAuthContext()

    expect(ctx.user).toBeNull()
    expect(ctx.userId).toBeNull()
    expect(ctx.isGuest).toBe(false)
  })

  it('미인증 + __guest=1 쿠키 → user=null, isGuest=true', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })
    mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue({ value: '1' }) })

    const ctx = await getAuthContext()

    expect(ctx.user).toBeNull()
    expect(ctx.userId).toBeNull()
    expect(ctx.isGuest).toBe(true)
  })

  it('미인증 + __guest=0 쿠키 → isGuest=false', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })
    mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue({ value: '0' }) })

    const ctx = await getAuthContext()

    expect(ctx.isGuest).toBe(false)
  })
})
