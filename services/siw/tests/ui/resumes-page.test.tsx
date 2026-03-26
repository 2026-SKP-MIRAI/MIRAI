import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// Next.js mocking
const mockPush = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}))

// framer-motion mock
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { variants, initial, animate, ...rest } = props
      void variants; void initial; void animate
      return <div {...rest}>{children}</div>
    },
  },
}))

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

import ResumesPage from "@/app/(app)/resumes/page"

describe("ResumesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("API 실패 시 에러 메시지와 새로고침 버튼이 표시된다", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"))
    render(<ResumesPage />)

    await waitFor(() => {
      expect(screen.getByText(/이력서 목록을 불러오지 못했습니다/)).toBeInTheDocument()
    })

    expect(screen.getByRole("button", { name: /새로고침/ })).toBeInTheDocument()
  })

  it("API 5xx 응답 시 에러 메시지가 표시된다", async () => {
    mockFetch.mockResolvedValueOnce(new Response("Internal Server Error", { status: 500 }))
    render(<ResumesPage />)

    await waitFor(() => {
      expect(screen.getByText(/이력서 목록을 불러오지 못했습니다/)).toBeInTheDocument()
    })
  })

  it("API가 배열이 아닌 응답을 반환하면 에러 메시지가 표시된다", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: "server error" }), { status: 200 }))
    render(<ResumesPage />)

    await waitFor(() => {
      expect(screen.getByText(/이력서 목록을 불러오지 못했습니다/)).toBeInTheDocument()
    })
  })

  it("에러 상태에서 새로고침 버튼 클릭 시 재요청한다", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"))
    render(<ResumesPage />)

    await waitFor(() => {
      expect(screen.getByText(/이력서 목록을 불러오지 못했습니다/)).toBeInTheDocument()
    })

    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
    fireEvent.click(screen.getByRole("button", { name: /새로고침/ }))

    await waitFor(() => {
      expect(screen.queryByText(/이력서 목록을 불러오지 못했습니다/)).not.toBeInTheDocument()
    })
  })

  it("정상 응답 시 이력서 목록이 표시된다", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([
      { id: "1", fileName: "resume.pdf", uploadedAt: "2026-01-01T00:00:00Z", questionCount: 3, categories: [], inferredTargetRole: "개발자" },
    ]), { status: 200 }))
    render(<ResumesPage />)

    await waitFor(() => {
      expect(screen.getByText("resume.pdf")).toBeInTheDocument()
    })
  })

  it("빈 배열 응답 시 빈 상태 메시지가 표시된다", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
    render(<ResumesPage />)

    await waitFor(() => {
      expect(screen.getByText(/아직 업로드한 이력서가 없습니다/)).toBeInTheDocument()
    })
  })
})
