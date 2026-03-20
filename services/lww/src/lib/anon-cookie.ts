import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const COOKIE_NAME = 'lww_anon_id'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 24 * 365,
  path: '/',
}

export async function getOrCreateAnonId(): Promise<{
  anonymousId: string
  isNew: boolean
}> {
  const cookieStore = await cookies()
  const existing = cookieStore.get(COOKIE_NAME)?.value
  if (existing) return { anonymousId: existing, isNew: false }
  return { anonymousId: crypto.randomUUID(), isNew: true }
}

/** answer/end 라우트 전용: 쿠키가 없으면 null 반환 (새 ID 생성 안 함) */
export async function getAnonId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value ?? null
}

export function setAnonCookie(response: NextResponse, anonymousId: string): NextResponse {
  response.cookies.set(COOKIE_NAME, anonymousId, COOKIE_OPTIONS)
  return response
}
