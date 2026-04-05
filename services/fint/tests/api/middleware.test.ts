import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock declarations (hoisted by vitest) ──────────────────────────────────

const mockLimit = vi.fn();

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = vi.fn().mockReturnValue("sliding-window-config");
    limit = mockLimit;
  },
}));

vi.mock("@upstash/redis/cloudflare", () => ({
  Redis: {
    fromEnv: vi.fn().mockReturnValue({}),
  },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  }),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(pathname: string, ip = "1.2.3.4"): NextRequest {
  const req = new NextRequest(`http://localhost${pathname}`, { method: "POST" });
  Object.defineProperty(req, "headers", {
    value: new Headers({ "x-forwarded-for": ip }),
    writable: false,
  });
  return req;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("middleware — Upstash rate limiter (env vars set)", () => {
  let middleware: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
    mockLimit.mockReset();

    const mod = await import("../../src/middleware");
    middleware = mod.middleware as unknown as (req: NextRequest) => Promise<Response>;
  });

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("정상 요청 — success:true 시 429 반환 안 함", async () => {
    mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 60000 });

    const res = await middleware(makeRequest("/api/interview/start"));
    expect(res.status).not.toBe(429);
  });

  it("rate limit 초과 — success:false 시 429 반환", async () => {
    mockLimit.mockResolvedValue({ success: false, reset: Date.now() + 30000 });

    const res = await middleware(makeRequest("/api/interview/answer"));
    expect(res.status).toBe(429);
  });

  it("429 응답에 Retry-After 헤더와 한국어 메시지 포함", async () => {
    const resetAt = Date.now() + 45000;
    mockLimit.mockResolvedValue({ success: false, reset: resetAt });

    const res = await middleware(makeRequest("/api/interview/answer"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    const retryAfter = Number(res.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);
    const body = await res.json();
    expect(body.message).toContain("요청이 너무 많습니다");
  });

  it("key 분리 — 다른 routePrefix는 다른 key로 limit() 호출", async () => {
    mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 60000 });

    await middleware(makeRequest("/api/interview/start", "10.0.0.1"));
    await middleware(makeRequest("/api/resume/questions", "10.0.0.1"));

    expect(mockLimit).toHaveBeenCalledTimes(2);
    const calls = mockLimit.mock.calls.map((c) => c[0] as string);
    expect(calls[0]).toContain("interview");
    expect(calls[1]).toContain("resume");
    expect(calls[0]).not.toBe(calls[1]);
  });

  it("graceful degradation — limit() throw 시 요청 통과 (fail-open)", async () => {
    mockLimit.mockRejectedValue(new Error("Redis connection refused"));

    const res = await middleware(makeRequest("/api/interview/start"));
    expect(res.status).not.toBe(429);
    expect(res.status).not.toBe(500);
  });

  it("rate limit 대상이 아닌 경로 — limit() 호출 없음", async () => {
    const res = await middleware(makeRequest("/"));
    expect(mockLimit).not.toHaveBeenCalled();
    expect(res.status).not.toBe(429);
  });
});

describe("middleware — 환경변수 미설정 (development)", () => {
  let middleware: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    mockLimit.mockReset();

    const mod = await import("../../src/middleware");
    middleware = mod.middleware as unknown as (req: NextRequest) => Promise<Response>;
  });

  it("환경변수 미설정 시 rate limit 건너뜀 — 요청 통과", async () => {
    const res = await middleware(makeRequest("/api/interview/start"));
    expect(mockLimit).not.toHaveBeenCalled();
    expect(res.status).not.toBe(429);
  });
});
