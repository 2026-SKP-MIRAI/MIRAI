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

describe("LandingPage", () => {
  it('FEATURES 배지 "핵심 기능"이 렌더링된다', () => {
    render(<LandingPage />)
    expect(screen.getByText("핵심 기능")).toBeInTheDocument()
  })

  it('FEATURES h2 "면접 준비의 새로운 기준"이 렌더링된다', () => {
    render(<LandingPage />)
    expect(screen.getByText("면접 준비의 새로운 기준")).toBeInTheDocument()
  })

  it('PERSONAS h2 "실제 면접처럼, 더 실전같이"가 렌더링된다', () => {
    render(<LandingPage />)
    expect(screen.getByText(/실제 면접처럼/)).toBeInTheDocument()
  })

  it('evaluation 섹션(id="evaluation")이 존재한다', () => {
    const { container } = render(<LandingPage />)
    expect(container.querySelector("#evaluation")).toBeInTheDocument()
  })

  it('EVALUATION h2 "단순 점수가 아닌,"이 렌더링된다', () => {
    render(<LandingPage />)
    expect(screen.getByText(/단순 점수가 아닌/)).toBeInTheDocument()
  })

  it('NAV "평가시스템" 링크가 href="#evaluation"을 가진다', () => {
    render(<LandingPage />)
    const link = screen.getByRole("link", { name: "평가시스템" })
    expect(link).toHaveAttribute("href", "#evaluation")
  })
})
