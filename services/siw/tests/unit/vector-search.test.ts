import { describe, it, expect, vi, beforeEach } from "vitest"

const mockQueryRaw = vi.fn()
vi.mock("@/lib/rag-prisma", () => ({
  ragPrisma: { $queryRaw: mockQueryRaw },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe("searchSimilarPostings", () => {
  it("ragPrisma.$queryRaw 결과를 SimilarPosting 배열로 변환", async () => {
    mockQueryRaw.mockResolvedValue([
      {
        title: "백엔드 개발자",
        company: "테스트 주식회사",
        source_url: "https://jobkorea.co.kr/1",
        job_role: "백엔드",
        similarity: 0.9,
      },
    ])

    const { searchSimilarPostings } = await import("@/lib/rag/vector-search")
    const result = await searchSimilarPostings([0.1, 0.2, 0.3], "백엔드")

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      title: "백엔드 개발자",
      company: "테스트 주식회사",
      sourceUrl: "https://jobkorea.co.kr/1",
      jobRole: "백엔드",
      similarity: 0.9,
    })
    expect(mockQueryRaw).toHaveBeenCalledOnce()
  })

  it("빈 결과 시 빈 배열 반환", async () => {
    mockQueryRaw.mockResolvedValue([])

    const { searchSimilarPostings } = await import("@/lib/rag/vector-search")
    const result = await searchSimilarPostings([0.1, 0.2], "프론트엔드")

    expect(result).toEqual([])
  })

  it("similarity를 Number로 변환 (DB에서 string으로 올 수 있음)", async () => {
    mockQueryRaw.mockResolvedValue([
      {
        title: "테스트",
        company: "회사",
        source_url: "https://example.com",
        job_role: "백엔드",
        similarity: "0.87654",
      },
    ])

    const { searchSimilarPostings } = await import("@/lib/rag/vector-search")
    const result = await searchSimilarPostings([0.1], "백엔드")

    expect(typeof result[0].similarity).toBe("number")
    expect(result[0].similarity).toBeCloseTo(0.87654)
  })
})

describe("extractTrendSkills", () => {
  it("알려진 jobRole에 해당하는 스킬 배열 반환", async () => {
    const { extractTrendSkills } = await import("@/lib/rag/vector-search")
    const skills = extractTrendSkills("백엔드")

    expect(skills).toContain("Java")
    expect(skills).toContain("Spring")
    expect(skills.length).toBeGreaterThan(0)
  })

  it("프론트엔드 스킬 반환", async () => {
    const { extractTrendSkills } = await import("@/lib/rag/vector-search")
    const skills = extractTrendSkills("프론트엔드")

    expect(skills).toContain("React")
    expect(skills).toContain("TypeScript")
  })

  it("알 수 없는 jobRole이면 fallback(최대 10개) 반환", async () => {
    const { extractTrendSkills } = await import("@/lib/rag/vector-search")
    const skills = extractTrendSkills("알수없는직군")

    expect(skills.length).toBeLessThanOrEqual(10)
    expect(skills.length).toBeGreaterThan(0)
  })
})

describe("getTrendSkillsForRole", () => {
  it("searchSimilarPostings 성공 시 스킬 배열 반환", async () => {
    mockQueryRaw.mockResolvedValue([
      {
        title: "채용공고",
        company: "회사",
        source_url: "https://example.com",
        job_role: "백엔드",
        similarity: 0.85,
      },
    ])

    const { getTrendSkillsForRole } = await import("@/lib/rag/vector-search")
    const skills = await getTrendSkillsForRole([0.1, 0.2], "백엔드")

    expect(Array.isArray(skills)).toBe(true)
    expect(skills.length).toBeGreaterThan(0)
  })

  it("searchSimilarPostings 결과 없으면 빈 배열 반환", async () => {
    mockQueryRaw.mockResolvedValue([])

    const { getTrendSkillsForRole } = await import("@/lib/rag/vector-search")
    const skills = await getTrendSkillsForRole([0.1, 0.2], "백엔드")

    expect(skills).toEqual([])
  })

  it("ragPrisma 오류 시 빈 배열 graceful fallback", async () => {
    mockQueryRaw.mockRejectedValue(new Error("DB connection failed"))

    const { getTrendSkillsForRole } = await import("@/lib/rag/vector-search")
    const skills = await getTrendSkillsForRole([0.1, 0.2], "백엔드")

    expect(skills).toEqual([])
  })
})
