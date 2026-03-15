import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

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

  // 세션 갱신 — getUser() 호출 필수 (getSession() 사용 금지)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const redirectTo = request.nextUrl.pathname
    const loginUrl = new URL("/login", request.url)
    // Open Redirect 방어: 내부 경로만 허용
    if (redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
      loginUrl.searchParams.set("redirectTo", redirectTo)
    }
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/resumes/:path*",
    "/interview/:path*",
    "/growth/:path*",
  ],
}
