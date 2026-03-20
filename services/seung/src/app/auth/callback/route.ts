import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('error', 'invalid_code')
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.redirect(new URL('/dashboard', request.url))
}
