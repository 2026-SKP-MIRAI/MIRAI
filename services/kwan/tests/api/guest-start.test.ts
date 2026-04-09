// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/guest/start/route'
import { NextRequest } from 'next/server'

function makeRequest(url: string): NextRequest {
  return new NextRequest(url)
}

describe('GET /api/guest/start', () => {
  it('기본 동작: /upload으로 리다이렉트', async () => {
    const req = makeRequest('http://localhost:3000/api/guest/start')
    const res = await GET(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/upload')
  })

  it('__guest=1 쿠키 설정 확인', async () => {
    const req = makeRequest('http://localhost:3000/api/guest/start')
    const res = await GET(req)

    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('__guest=1')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Path=/')
  })

  it('next 파라미터 있음 → 해당 경로로 리다이렉트', async () => {
    const req = makeRequest('http://localhost:3000/api/guest/start?next=/interview')
    const res = await GET(req)

    expect(res.headers.get('location')).toContain('/interview')
  })

  it('open-redirect 방어: 외부 URL → /upload 폴백', async () => {
    const req = makeRequest('http://localhost:3000/api/guest/start?next=https://evil.com')
    const res = await GET(req)

    const location = res.headers.get('location') ?? ''
    expect(location).not.toContain('evil.com')
    expect(location).toContain('/upload')
  })

  it('open-redirect 방어: // 시작 → /upload 폴백', async () => {
    const req = makeRequest('http://localhost:3000/api/guest/start?next=//evil.com')
    const res = await GET(req)

    const location = res.headers.get('location') ?? ''
    expect(location).not.toContain('evil.com')
    expect(location).toContain('/upload')
  })
})
