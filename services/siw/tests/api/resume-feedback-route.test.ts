import { describe, it, expect, vi, beforeEach } from "vitest"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
}))

const mockGetUser = vi.fn()
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
  }),
}))

const mockFindDetailById = vi.fn()
vi.mock("@/lib/resume-repository", () => ({
  resumeRepository: {
    findDetailById: (...args: unknown[]) => mockFindDetailById(...args),
  },
}))

const authenticatedUser = { id: "user-123", email: "test@example.com" }

beforeEach(() => {
  vi.clearAllMocks()
})

describe("GET /api/resumes/[id]/feedback", () => {
  it("200 — feedbackJson 있을 때 반환", async () => {
    mockGetUser.mockResolvedValue({ data: { user: authenticatedUser } })
    const feedbackData = { scores: { specificity: 80, achievementClarity: 70, logicStructure: 75, roleAlignment: 85, differentiation: 60 }, strengths: ["강점1"], weaknesses: ["약점1"], suggestions: [] }
    mockFindDetailById.mockResolvedValue({ id: "resume-1", feedbackJson: feedbackData })

    const { GET } = await import("@/app/api/resumes/[id]/feedback/route")
    const res = await GET(new Request("http://localhost/api/resumes/resume-1/feedback"), { params: Promise.resolve({ id: "resume-1" }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ feedback: feedbackData, trendComparison: null })
  })

  it("200+null — feedbackJson=null일 때 null 반환", async () => {
    mockGetUser.mockResolvedValue({ data: { user: authenticatedUser } })
    mockFindDetailById.mockResolvedValue({ id: "resume-1", feedbackJson: null })

    const { GET } = await import("@/app/api/resumes/[id]/feedback/route")
    const res = await GET(new Request("http://localhost/api/resumes/resume-1/feedback"), { params: Promise.resolve({ id: "resume-1" }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ feedback: null, trendComparison: null })
  })

  it("401 — 미인증", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { GET } = await import("@/app/api/resumes/[id]/feedback/route")
    const res = await GET(new Request("http://localhost/api/resumes/resume-1/feedback"), { params: Promise.resolve({ id: "resume-1" }) })
    expect(res.status).toBe(401)
  })

  it("404 — resume 없음", async () => {
    mockGetUser.mockResolvedValue({ data: { user: authenticatedUser } })
    mockFindDetailById.mockRejectedValue(new Error("Resume not found"))

    const { GET } = await import("@/app/api/resumes/[id]/feedback/route")
    const res = await GET(new Request("http://localhost/api/resumes/resume-1/feedback"), { params: Promise.resolve({ id: "resume-1" }) })
    expect(res.status).toBe(404)
  })
})
