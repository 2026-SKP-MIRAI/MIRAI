import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
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
    pathname.startsWith('/upload') ||
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

  // 비회원 모드: __guest 쿠키가 있으면 upload/diagnosis/report만 허용
  // dashboard, interview는 로그인 필요
  const isGuestMode = request.cookies.get('__guest')?.value === '1'
  const isGuestAllowed =
    isGuestMode &&
    !pathname.startsWith('/dashboard') &&
    !pathname.startsWith('/interview')

  // API 라우트는 리다이렉트 없이 세션만 갱신 — 각 handler에서 401 반환
  if (!user && isProtectedPage && !isE2EBypass && !isGuestAllowed) {
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
