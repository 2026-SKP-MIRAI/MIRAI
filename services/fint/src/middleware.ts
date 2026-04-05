import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis/cloudflare";

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

let ratelimit: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "1 m"),
  });
} else if (process.env.NODE_ENV === "production") {
  console.error(
    "[middleware] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 미설정 — rate limit 비활성화됨 (보안 위험)"
  );
} else {
  console.warn("[middleware] Upstash 환경변수 미설정 — rate limit 비활성화 (개발 환경)");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Rate limit (API routes only)
  if (
    ratelimit &&
    (pathname.startsWith("/api/interview/") || pathname.startsWith("/api/resume/"))
  ) {
    const ip = getClientIP(request);
    const routePrefix = pathname.split("/").slice(0, 4).join("/");
    const key = `${ip}:${routePrefix}`;

    try {
      const { success, reset } = await ratelimit.limit(key);
      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000);
        return NextResponse.json(
          { message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
          {
            status: 429,
            headers: { "Retry-After": String(retryAfter) },
          }
        );
      }
    } catch (err) {
      // fail-open: Redis 장애 시 서비스 가용성 우선
      console.error("[middleware] Redis rate limit 오류 (fail-open)", err);
    }
  }

  // 2. Supabase 세션 갱신 (전체 경로, LWW는 절대 리다이렉트 금지)
  let supabaseResponse = NextResponse.next({ request });
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );
    // 세션 갱신 목적만 — 결과 무시, 익명 사용자 리다이렉트 절대 금지
    await supabase.auth.getUser();
  } catch {
    // auth 인프라 장애 시에도 익명 기능은 정상 동작해야 함
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
