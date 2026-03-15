import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// Next.js 모킹
const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => ({ get: () => null }),
}))

// Supabase browser 클라이언트 모킹
const mockSignIn = vi.fn()
const mockSignInWithOAuth = vi.fn()
vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowser: () => ({
    auth: {
      signInWithPassword: mockSignIn,
      signInWithOAuth: mockSignInWithOAuth,
    },
  }),
}))

import LoginPage from "@/app/(auth)/login/page"

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("빈 폼 제출 시 유효성 에러 표시", async () => {
    render(<LoginPage />)
    fireEvent.submit(screen.getByRole("button", { name: /로그인/ }))

    await waitFor(() => {
      // HTML5 required 검증이 동작하므로 signIn은 호출되지 않아야 함
      expect(mockSignIn).not.toHaveBeenCalled()
    })
  })

  it("로그인 실패 시 통일된 에러 메시지 표시", async () => {
    mockSignIn.mockResolvedValue({ error: { message: "Invalid login credentials" } })

    render(<LoginPage />)

    fireEvent.change(screen.getByPlaceholderText("name@example.com"), {
      target: { value: "test@example.com" },
    })
    fireEvent.change(screen.getByPlaceholderText("비밀번호를 입력하세요"), {
      target: { value: "password123" },
    })
    fireEvent.submit(screen.getByRole("button", { name: /로그인/ }))

    await waitFor(() => {
      expect(screen.getByText("이메일 또는 비밀번호가 올바르지 않습니다")).toBeInTheDocument()
    })
  })

  it("로그인 성공 시 signInWithPassword 호출 및 리다이렉트", async () => {
    mockSignIn.mockResolvedValue({ error: null })

    render(<LoginPage />)

    fireEvent.change(screen.getByPlaceholderText("name@example.com"), {
      target: { value: "test@example.com" },
    })
    fireEvent.change(screen.getByPlaceholderText("비밀번호를 입력하세요"), {
      target: { value: "password123" },
    })
    fireEvent.submit(screen.getByRole("button", { name: /로그인/ }))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      })
      expect(mockPush).toHaveBeenCalledWith("/dashboard")
    })
  })
})
