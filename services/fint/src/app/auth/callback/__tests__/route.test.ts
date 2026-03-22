import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock은 파일 최상단으로 호이스팅됨 — import보다 먼저 선언
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { GET } from "../route";
import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

const mockCreateClient = vi.mocked(createClient);
const mockCreateServiceClient = vi.mocked(createServiceClient);
const mockCookies = vi.mocked(cookies);

function makeRequest(url: string) {
  return new NextRequest(url);
}

describe("GET /auth/callback", () => {
  const origin = "http://localhost:3000";
  const mockExchangeCodeForSession = vi.fn();
  const mockRpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue({
      auth: { exchangeCodeForSession: mockExchangeCodeForSession },
    } as never);
    mockCreateServiceClient.mockReturnValue({
      rpc: mockRpc,
    } as never);
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "test-anon-id-12345" }),
    } as never);
  });

  it("code 없으면 /login?error=oauth 리다이렉트", async () => {
    const req = makeRequest(`${origin}/auth/callback`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${origin}/login?error=oauth`);
  });

  it("exchangeCodeForSession 실패 시 /login?error=oauth 리다이렉트", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: null },
      error: new Error("invalid"),
    });
    const req = makeRequest(`${origin}/auth/callback?code=bad-code`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${origin}/login?error=oauth`);
  });

  it("성공 + anonId 있으면 migrate_anon_to_user RPC 호출 후 / 리다이렉트", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockRpc.mockResolvedValue({ error: null });

    const req = makeRequest(`${origin}/auth/callback?code=valid-code`);
    const res = await GET(req);

    expect(mockRpc).toHaveBeenCalledWith("migrate_anon_to_user", {
      p_anon_id: "test-anon-id-12345",
      p_user_id: "user-123",
    });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${origin}/`);
  });

  it("next 파라미터로 safeRedirect", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockRpc.mockResolvedValue({ error: null });

    const req = makeRequest(`${origin}/auth/callback?code=valid-code&next=%2Freport%2Fabc`);
    const res = await GET(req);
    expect(res.headers.get("location")).toBe(`${origin}/report/abc`);
  });

  it("Open Redirect 방어: next=//evil.com → / 리다이렉트", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockRpc.mockResolvedValue({ error: null });

    const req = makeRequest(`${origin}/auth/callback?code=valid-code&next=%2F%2Fevil.com`);
    const res = await GET(req);
    expect(res.headers.get("location")).toBe(`${origin}/`);
  });

  it("마이그레이션 RPC 실패해도 로그인은 성공", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockRpc.mockResolvedValue({ error: new Error("rpc failed") });

    const req = makeRequest(`${origin}/auth/callback?code=valid-code`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${origin}/`);
  });
});
