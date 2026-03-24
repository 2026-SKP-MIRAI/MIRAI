import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchSimilarAcceptedResumes } from '../resume-search'

vi.mock('@/lib/rag-prisma', () => ({
  ragPrisma: {
    $queryRaw: vi.fn(),
  },
}))

import { ragPrisma } from '@/lib/rag-prisma'

describe('searchSimilarAcceptedResumes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('결과를 올바르게 매핑하여 반환한다', async () => {
    const mockRows = [
      { id: 'uuid-1', job_role: '백엔드', content: '합격 자소서 내용 1', similarity: 0.92 },
      { id: 'uuid-2', job_role: '백엔드', content: '합격 자소서 내용 2', similarity: 0.87 },
    ]
    vi.mocked(ragPrisma.$queryRaw).mockResolvedValue(mockRows)

    const result = await searchSimilarAcceptedResumes([0.1, 0.2], '백엔드', 5)

    expect(ragPrisma.$queryRaw).toHaveBeenCalledOnce()
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: 'uuid-1',
      jobRole: '백엔드',
      content: '합격 자소서 내용 1',
      similarity: 0.92,
    })
    expect(result[1].similarity).toBe(0.87)
  })

  it('jobRole 필터 있을 때 다른 SQL 경로 호출 (쿼리 1회)', async () => {
    vi.mocked(ragPrisma.$queryRaw).mockResolvedValue([])

    await searchSimilarAcceptedResumes([0.1, 0.2], '프론트엔드', 5)

    expect(ragPrisma.$queryRaw).toHaveBeenCalledOnce()
  })

  it('jobRole 없을 때도 쿼리 1회 호출 (전체 검색)', async () => {
    vi.mocked(ragPrisma.$queryRaw).mockResolvedValue([])

    await searchSimilarAcceptedResumes([0.1, 0.2], undefined, 5)

    expect(ragPrisma.$queryRaw).toHaveBeenCalledOnce()
  })

  it('결과 없을 때 빈 배열 반환', async () => {
    vi.mocked(ragPrisma.$queryRaw).mockResolvedValue([])

    const result = await searchSimilarAcceptedResumes([0.1, 0.2], '백엔드', 5)

    expect(result).toEqual([])
  })

  it('DB 오류 시 에러를 그대로 throw한다', async () => {
    vi.mocked(ragPrisma.$queryRaw).mockRejectedValue(new Error('DB connection error'))

    await expect(
      searchSimilarAcceptedResumes([0.1, 0.2], '백엔드', 5)
    ).rejects.toThrow('DB connection error')
  })

  it('similarity 값을 Number로 변환한다', async () => {
    const mockRows = [
      { id: 'uuid-1', job_role: '데이터', content: '내용', similarity: '0.75' },
    ]
    vi.mocked(ragPrisma.$queryRaw).mockResolvedValue(mockRows)

    const result = await searchSimilarAcceptedResumes([0.1], '데이터', 1)

    expect(typeof result[0].similarity).toBe('number')
    expect(result[0].similarity).toBe(0.75)
  })
})
