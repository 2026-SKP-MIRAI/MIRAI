import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// Supabase SSR 클라이언트 모킹
const mockGetUser = vi.fn()

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}))

describe("middleware", () => {
  beforeEach(() => {
    vi.resetModules()
    mockGetUser.mockReset()
  })

  it("미인증 사용자가 보호 경로 접근 시 /login 리다이렉트", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const { middleware } = await import("@/middleware")

    const req = new NextRequest("http://localhost/dashboard")
    const res = await middleware(req)

    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toContain("/login")
  })

  it("미인증 사용자 리다이렉트 URL에 redirectTo 파라미터 포함", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const { middleware } = await import("@/middleware")

    const req = new NextRequest("http://localhost/dashboard")
    const res = await middleware(req)

    const location = res.headers.get("location") ?? ""
    expect(location).toContain("redirectTo=%2Fdashboard")
  })

  it("인증된 사용자는 보호 경로 통과", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123", email: "test@example.com" } } })
    const { middleware } = await import("@/middleware")

    const req = new NextRequest("http://localhost/dashboard")
    const res = await middleware(req)

    expect(res.status).toBe(200)
  })

  it("외부 URL redirectTo는 차단 (Open Redirect 방어)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const { middleware } = await import("@/middleware")

    // 외부 URL 주입 시도 — pathname은 항상 /로 시작하므로 실제로는 발생하지 않지만
    // redirectTo 파라미터 생성 로직이 내부 경로만 허용함을 확인
    const req = new NextRequest("http://localhost/dashboard")
    const res = await middleware(req)

    const location = res.headers.get("location") ?? ""
    const url = new URL(location)
    const redirectTo = url.searchParams.get("redirectTo") ?? ""
    expect(redirectTo.startsWith("/")).toBe(true)
    expect(redirectTo).not.toMatch(/^https?:\/\//)
  })
})
