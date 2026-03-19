import { NextRequest, NextResponse } from "next/server";

// In-memory rate limiter (개발/MVP 용)
// Production: Upstash Redis 교체 권장
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT = 10; // requests per window
const WINDOW_MS = 60 * 1000; // 1 minute

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limit only API routes
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
            "Retry-After": String(Math.ceil((current.resetTime - now) / 1000)),
          },
        }
      );
    } else {
      current.count++;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/interview/:path*", "/api/resume/:path*"],
};
