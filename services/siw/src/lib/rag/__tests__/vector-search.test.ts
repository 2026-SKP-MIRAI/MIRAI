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

  it('NaN 포함 벡터일 때 빈 배열 반환 (SQL injection 방지)', async () => {
    const result = await searchSimilarPostings([0.1, NaN], '백엔드', 5)

    expect(result).toEqual([])
    expect(ragPrisma.$queryRaw).not.toHaveBeenCalled()
  })

  it('빈 벡터일 때 빈 배열 반환', async () => {
    const result = await searchSimilarPostings([], '백엔드', 5)

    expect(result).toEqual([])
    expect(ragPrisma.$queryRaw).not.toHaveBeenCalled()
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
  it('빈 postings → 빈 배열 반환', () => {
    const result = extractTrendSkills([])
    expect(result).toEqual([])
  })

  it('content에 스킬 키워드 있으면 추출', () => {
    const postings = [
      { title: 'Spring 백엔드', company: 'A', content: 'Java Spring Docker REST API 경험', similarity: 0.9, sourceUrl: 'http://x', jobRole: '백엔드' },
      { title: '백엔드', company: 'B', content: 'Java Spring Kubernetes 운영', similarity: 0.8, sourceUrl: 'http://y', jobRole: '백엔드' },
    ]
    const result = extractTrendSkills(postings)
    const skills = result.map((s) => s.skill)
    expect(skills).toContain('Spring')  // 2회 등장
    expect(skills).toContain('Java')
    expect(result[0].weight).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(10)
  })

  it('content에 매칭 없으면 role 기반 fallback', () => {
    const postings = [
      { title: '백엔드', company: 'A', content: '알수없는내용만있음', similarity: 0.8, sourceUrl: 'http://x', jobRole: '백엔드' },
    ]
    const result = extractTrendSkills(postings)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].weight).toBeGreaterThan(0)
  })

  it('결과는 빈도 내림차순', () => {
    const postings = [
      { title: 'A', company: 'A', content: 'Java Spring Docker', similarity: 0.9, sourceUrl: 'http://x', jobRole: '백엔드' },
      { title: 'B', company: 'B', content: 'Java Spring', similarity: 0.8, sourceUrl: 'http://y', jobRole: '백엔드' },
      { title: 'C', company: 'C', content: 'Java', similarity: 0.7, sourceUrl: 'http://z', jobRole: '백엔드' },
    ]
    const result = extractTrendSkills(postings)
    // Java(3회)가 가장 앞에 와야 함
    expect(result[0].skill).toBe('Java')
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

  it('정상 경로: content 기반 스킬 string[] 반환', async () => {
    const mockRows = [
      { title: 'Spring 개발자', company: 'C', content: 'Java Spring Docker', source_url: 'http://x', job_role: '백엔드', similarity: 0.9 },
    ]
    vi.mocked(ragPrisma.$queryRaw).mockResolvedValue(mockRows)
    const result = await getTrendSkillsForRole([0.1], '백엔드')
    expect(Array.isArray(result)).toBe(true)
    expect(result.every((s) => typeof s === 'string')).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })
})
