import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10;
const WINDOW_MS = 60 * 1000;

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Rate limit (API routes only)
  if (pathname.startsWith("/api/interview/") || pathname.startsWith("/api/resume/")) {
    const ip = getClientIP(request);
    const now = Date.now();
    const key = `${ip}:${pathname.split("/").slice(0, 4).join("/")}`;
    const current = rateLimitMap.get(key);
    if (!current || now > current.resetTime) {
      rateLimitMap.set(key, { count: 1, resetTime: now + WINDOW_MS });
    } else if (current.count >= RATE_LIMIT) {
      return NextResponse.json(
        { message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((current.resetTime - Date.now()) / 1000)),
          },
        }
      );
    } else {
      current.count++;
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
