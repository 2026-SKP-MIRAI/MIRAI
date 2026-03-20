import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
}))

const mockGetUser = vi.fn()
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
  }),
}))

vi.mock("@/lib/rag/embedding-client", () => ({
  fetchTrendSkills: vi.fn().mockResolvedValue([]),
}))

const authenticatedUser = { id: "user-123", email: "test@example.com" }

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe("GET /api/resumes/trends", () => {
  it("ENABLE_RAG 미설정 시 200 { skills: [], enabled: false }", async () => {
    mockGetUser.mockResolvedValue({ data: { user: authenticatedUser } })

    const { GET } = await import("@/app/api/resumes/trends/route")
    const res = await GET(new Request("http://localhost/api/resumes/trends?role=백엔드 개발자"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ skills: [], enabled: false })
  })

  it("미인증 시 401", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { GET } = await import("@/app/api/resumes/trends/route")
    const res = await GET(new Request("http://localhost/api/resumes/trends?role=백엔드 개발자"))
    expect(res.status).toBe(401)
  })
})
