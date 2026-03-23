import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchSimilarPostings, extractTrendSkills, getTrendSkillsForRole } from '../vector-search'

vi.mock('@/lib/rag-prisma', () => ({
  ragPrisma: {
    $queryRaw: vi.fn(),
  },
}))

import { ragPrisma } from '@/lib/rag-prisma'

describe('searchSimilarPostings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prisma.$queryRaw를 호출하고 결과를 매핑한다', async () => {
    const mockRows = [
      { title: '백엔드 개발자', company: '테스트컴퍼니', source_url: 'http://example.com/1', job_role: '백엔드', similarity: 0.85 },
    ]
    vi.mocked(ragPrisma.$queryRaw).mockResolvedValue(mockRows)

    const result = await searchSimilarPostings([0.1, 0.2], '백엔드', 5)

    expect(ragPrisma.$queryRaw).toHaveBeenCalledOnce()
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('백엔드 개발자')
    expect(result[0].sourceUrl).toBe('http://example.com/1')
    expect(result[0].similarity).toBe(0.85)
  })
})

describe('extractTrendSkills', () => {
  it('알려진 role에 대해 TECH_SKILLS 반환', () => {
    const skills = extractTrendSkills('백엔드')
    expect(skills).toContain('Spring')
    expect(skills.length).toBeGreaterThan(0)
  })

  it('알 수 없는 role에 대해 fallback 반환', () => {
    const skills = extractTrendSkills('unknown-role')
    expect(skills.length).toBeGreaterThan(0)
    expect(skills.length).toBeLessThanOrEqual(10)
  })
})

describe('getTrendSkillsForRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('DB 오류 시 빈 배열 반환', async () => {
    vi.mocked(ragPrisma.$queryRaw).mockRejectedValue(new Error('DB error'))
    const result = await getTrendSkillsForRole([0.1], '백엔드')
    expect(result).toEqual([])
  })

  it('검색 결과 없을 시 빈 배열 반환', async () => {
    vi.mocked(ragPrisma.$queryRaw).mockResolvedValue([])
    const result = await getTrendSkillsForRole([0.1], '백엔드')
    expect(result).toEqual([])
  })

  it('정상 경로: postings 있으면 기술 스택 반환', async () => {
    const mockRows = [
      { title: 'T', company: 'C', source_url: 'http://x', job_role: '백엔드', similarity: 0.9 },
    ]
    vi.mocked(ragPrisma.$queryRaw).mockResolvedValue(mockRows)
    const result = await getTrendSkillsForRole([0.1], '백엔드')
    expect(result.length).toBeGreaterThan(0)
  })
})
