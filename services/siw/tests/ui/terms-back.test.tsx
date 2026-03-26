import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi, beforeAll } from "vitest"
import LandingPage from "@/app/(landing)/page"

// jsdom에 IntersectionObserver 없음 → stub 필수
beforeAll(() => {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowser: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn(),
    },
  }),
}))

vi.mock("@/components/landing/RadarChartInteractive", () => ({
  default: () => <div data-testid="radar-chart" />,
}))

vi.mock("@/components/landing/LayeredCardWrapper", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe("랜딩페이지 이용약관·개인정보 링크", () => {
  it("이용약관 링크에 ?from=landing 쿼리 파라미터가 포함된다", () => {
    render(<LandingPage />)
    const link = screen.getByRole("link", { name: "이용약관" })
    expect(link).toHaveAttribute("href", "/terms?from=landing")
  })

  it("개인정보처리방침 링크에 ?from=landing 쿼리 파라미터가 포함된다", () => {
    render(<LandingPage />)
    const link = screen.getByRole("link", { name: "개인정보처리방침" })
    expect(link).toHaveAttribute("href", "/privacy?from=landing")
  })
})

describe("TermsPage 뒤로가기 링크", () => {
  it("from=landing일 때 / 링크를 렌더링한다", async () => {
    const TermsPage = (await import("@/app/(auth)/terms/page")).default
    render(await TermsPage({ searchParams: Promise.resolve({ from: "landing" }) }))
    const backLink = screen.getByText("← 돌아가기")
    expect(backLink).toHaveAttribute("href", "/")
  })

  it("from 파라미터 없을 때 /signup 링크를 렌더링한다", async () => {
    const TermsPage = (await import("@/app/(auth)/terms/page")).default
    render(await TermsPage({ searchParams: Promise.resolve({}) }))
    const backLink = screen.getByText("← 회원가입으로 돌아가기")
    expect(backLink).toHaveAttribute("href", "/signup")
  })
})

describe("PrivacyPage 뒤로가기 링크", () => {
  it("from=landing일 때 / 링크를 렌더링한다", async () => {
    const PrivacyPage = (await import("@/app/(auth)/privacy/page")).default
    render(await PrivacyPage({ searchParams: Promise.resolve({ from: "landing" }) }))
    const backLink = screen.getByText("← 돌아가기")
    expect(backLink).toHaveAttribute("href", "/")
  })

  it("from 파라미터 없을 때 /signup 링크를 렌더링한다", async () => {
    const PrivacyPage = (await import("@/app/(auth)/privacy/page")).default
    render(await PrivacyPage({ searchParams: Promise.resolve({}) }))
    const backLink = screen.getByText("← 회원가입으로 돌아가기")
    expect(backLink).toHaveAttribute("href", "/signup")
  })
})
