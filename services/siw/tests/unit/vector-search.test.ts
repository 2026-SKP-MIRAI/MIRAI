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
    expect(result[0]).toMatchObject({
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
  it("content에서 백엔드 스킬 추출 — weight 정렬 및 범위 검증", async () => {
    const { extractTrendSkills } = await import("@/lib/rag/vector-search")
    const postings = [
      {
        title: "백엔드 개발자",
        company: "테스트",
        content: "Java Spring Boot REST API Docker 경험자 우대",
        sourceUrl: "https://example.com/1",
        jobRole: "백엔드",
        similarity: 0.9,
      },
    ]
    const skills = extractTrendSkills(postings)

    expect(skills.length).toBeGreaterThan(0)
    expect(skills.every((s) => typeof s.skill === "string")).toBe(true)
    expect(skills.every((s) => s.weight > 0 && s.weight <= 1)).toBe(true)
    expect(skills.map((s) => s.skill)).toContain("Java")
  })

  it("content에서 프론트엔드 스킬 추출", async () => {
    const { extractTrendSkills } = await import("@/lib/rag/vector-search")
    const postings = [
      {
        title: "프론트엔드 개발자",
        company: "테스트",
        content: "React TypeScript Next.js CSS 개발 경험",
        sourceUrl: "https://example.com/2",
        jobRole: "프론트엔드",
        similarity: 0.85,
      },
    ]
    const skills = extractTrendSkills(postings)

    expect(skills.map((s) => s.skill)).toContain("React")
    expect(skills.map((s) => s.skill)).toContain("TypeScript")
  })

  it("빈 postings 입력 시 빈 배열 반환", async () => {
    const { extractTrendSkills } = await import("@/lib/rag/vector-search")
    const skills = extractTrendSkills([])

    expect(skills).toEqual([])
  })

  it("content에 스킬 없으면 jobRole 기반 fallback 반환 (최대 10개)", async () => {
    const { extractTrendSkills } = await import("@/lib/rag/vector-search")
    const postings = [
      {
        title: "백엔드 개발자",
        company: "테스트",
        content: "면접 우대 복리후생 식대 지원",
        sourceUrl: "https://example.com/3",
        jobRole: "백엔드",
        similarity: 0.7,
      },
    ]
    const skills = extractTrendSkills(postings)

    expect(skills.length).toBeLessThanOrEqual(10)
    expect(skills.length).toBeGreaterThan(0)
    expect(skills.map((s) => s.skill)).toContain("Java")
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
