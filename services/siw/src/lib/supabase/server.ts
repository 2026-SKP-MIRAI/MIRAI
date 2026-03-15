import { createServerClient as createSSRClient } from "@supabase/ssr"
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies"
import { createClient } from "@supabase/supabase-js"

// SSR용 — middleware / Server Components / API Route에서 사용
export function createServerClient(cookieStore: ReadonlyRequestCookies) {
  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              (cookieStore as any).set(name, value, options)
            )
          } catch {
            // Server Component에서는 set 불가 — middleware에서 처리
          }
        },
      },
    }
  )
}

// Service role — RLS 우회 필요 시 (기존 유지)
export function createServiceClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
