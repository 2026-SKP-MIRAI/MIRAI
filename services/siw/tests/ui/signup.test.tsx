import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// Next.js 모킹
const mockPush = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}))

// Supabase browser 클라이언트 모킹
const mockSignUp = vi.fn()
vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowser: () => ({
    auth: {
      signUp: mockSignUp,
    },
  }),
}))

import SignupPage from "@/app/(auth)/signup/page"

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const fillForm = (password: string, confirmPassword: string) => {
    fireEvent.change(screen.getByPlaceholderText("홍길동"), {
      target: { value: "테스트" },
    })
    fireEvent.change(screen.getByPlaceholderText("name@example.com"), {
      target: { value: "test@example.com" },
    })
    fireEvent.change(screen.getByPlaceholderText("8자 이상"), { target: { value: password } })
    fireEvent.change(screen.getByPlaceholderText("비밀번호 재입력"), { target: { value: confirmPassword } })
    fireEvent.submit(screen.getByRole("button", { name: /가입하고 시작하기/ }))
  }

  it("비밀번호 7자 입력 시 Zod 에러", async () => {
    render(<SignupPage />)
    fillForm("abc123!", "abc123!")

    await waitFor(() => {
      expect(screen.getByText("8자 이상 입력해주세요")).toBeInTheDocument()
    })
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it("숫자 없는 비밀번호 입력 시 Zod 에러", async () => {
    render(<SignupPage />)
    fillForm("abcdefgh", "abcdefgh")

    await waitFor(() => {
      expect(screen.getByText("영문과 숫자를 포함해야 합니다")).toBeInTheDocument()
    })
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it("비밀번호 불일치 시 에러", async () => {
    render(<SignupPage />)
    fillForm("password123", "password456")

    await waitFor(() => {
      expect(screen.getByText("비밀번호가 일치하지 않습니다")).toBeInTheDocument()
    })
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it("유효한 입력 시 signUp 호출", async () => {
    mockSignUp.mockResolvedValue({ error: null })
    render(<SignupPage />)
    fillForm("password123", "password123")

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
        options: { data: { full_name: "테스트" } },
      })
    })
  })
})
