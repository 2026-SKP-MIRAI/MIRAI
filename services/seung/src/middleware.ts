import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 세션 갱신 (토큰 만료 시 자동 갱신)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isProtectedPage =
    pathname.startsWith('/resume') ||
    pathname.startsWith('/interview') ||
    pathname.startsWith('/report') ||
    pathname.startsWith('/diagnosis') ||
    pathname.startsWith('/dashboard')

  // E2E 테스트 환경에서만 인증 우회
  // - 로컬 개발(NODE_ENV !== 'production'): 자동 허용
  // - CI 프로덕션 빌드(E2E_AUTH_BYPASS=1 서버 환경변수 주입 시): 허용
  // - 실제 프로덕션(NODE_ENV=production, E2E_AUTH_BYPASS 미설정): 절대 동작 안 함
  const isE2EBypass =
    (process.env.NODE_ENV !== 'production' || process.env.E2E_AUTH_BYPASS === '1') &&
    request.cookies.get('__e2e_bypass')?.value === '1'

  // API 라우트는 리다이렉트 없이 세션만 갱신 — 각 handler에서 401 반환
  if (!user && isProtectedPage && !isE2EBypass) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // 정적 파일만 제외, API 포함 (세션 갱신 목적)
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
