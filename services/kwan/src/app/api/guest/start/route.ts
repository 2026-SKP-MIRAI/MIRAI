import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next') ?? '/upload'
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/upload'

  const response = NextResponse.redirect(new URL(safeNext, request.url))
  response.cookies.set('__guest', '1', {
    path: '/',
    maxAge: 60 * 60 * 24, // 24시간
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}
