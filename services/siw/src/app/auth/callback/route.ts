import { createServerClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const { searchParams } = requestUrl
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? requestUrl.host
  const proto = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "")
  const origin = `${proto}://${host}`
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/dashboard"

  // Open Redirect 방어
  const safeRedirect = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard"

  if (!code) return NextResponse.redirect(`${origin}/login?error=oauth`)

  const cookieStore = await cookies()
  const supabase = createServerClient(cookieStore)
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(`${origin}/login?error=oauth`)

  return NextResponse.redirect(`${origin}${safeRedirect}`)
}
