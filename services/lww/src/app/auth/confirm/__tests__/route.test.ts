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

describe("GET /auth/confirm", () => {
  const origin = "http://localhost:3000";
  const mockVerifyOtp = vi.fn();
  const mockGetUser = vi.fn();
  const mockRpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue({
      auth: {
        verifyOtp: mockVerifyOtp,
        getUser: mockGetUser,
      },
    } as never);
    mockCreateServiceClient.mockReturnValue({
      rpc: mockRpc,
    } as never);
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "test-anon-id-12345" }),
    } as never);
  });

  it("token_hash 없으면 /login?error=invalid_link 리다이렉트", async () => {
    const req = makeRequest(`${origin}/auth/confirm?type=email`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${origin}/login?error=invalid_link`);
  });

  it("type 없으면 /login?error=invalid_link 리다이렉트", async () => {
    const req = makeRequest(`${origin}/auth/confirm?token_hash=abc123`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${origin}/login?error=invalid_link`);
  });

  it("verifyOtp 실패 시 /login?error=invalid_link 리다이렉트", async () => {
    mockVerifyOtp.mockResolvedValue({ error: new Error("invalid token") });
    const req = makeRequest(`${origin}/auth/confirm?token_hash=bad-hash&type=email`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${origin}/login?error=invalid_link`);
  });

  it("성공 + anonId 있으면 migrate_anon_to_user RPC 호출 후 / 리다이렉트", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-456" } } });
    mockRpc.mockResolvedValue({ error: null });

    const req = makeRequest(`${origin}/auth/confirm?token_hash=valid-hash&type=email`);
    const res = await GET(req);

    expect(mockGetUser).toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith("migrate_anon_to_user", {
      p_anon_id: "test-anon-id-12345",
      p_user_id: "user-456",
    });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${origin}/`);
  });

  it("성공 + anonId 있으면 lww_anon_id 쿠키 삭제", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-456" } } });
    mockRpc.mockResolvedValue({ error: null });

    const req = makeRequest(`${origin}/auth/confirm?token_hash=valid-hash&type=email`);
    const res = await GET(req);

    // Set-Cookie 헤더에 lww_anon_id 만료 확인
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("lww_anon_id");
  });

  it("next 파라미터로 safeRedirect", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-456" } } });
    mockRpc.mockResolvedValue({ error: null });

    const req = makeRequest(`${origin}/auth/confirm?token_hash=valid-hash&type=email&next=%2Freport%2Fabc`);
    const res = await GET(req);
    expect(res.headers.get("location")).toBe(`${origin}/report/abc`);
  });

  it("Open Redirect 방어: next=//evil.com → / 리다이렉트", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-456" } } });
    mockRpc.mockResolvedValue({ error: null });

    const req = makeRequest(`${origin}/auth/confirm?token_hash=valid-hash&type=email&next=%2F%2Fevil.com`);
    const res = await GET(req);
    expect(res.headers.get("location")).toBe(`${origin}/`);
  });

  it("마이그레이션 RPC 실패해도 이메일 확인은 성공", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-456" } } });
    mockRpc.mockResolvedValue({ error: new Error("rpc failed") });

    const req = makeRequest(`${origin}/auth/confirm?token_hash=valid-hash&type=email`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${origin}/`);
  });

  it("anonId 없으면 RPC 호출 안 함", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    } as never);

    const req = makeRequest(`${origin}/auth/confirm?token_hash=valid-hash&type=email`);
    const res = await GET(req);

    expect(mockRpc).not.toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${origin}/`);
  });
});
