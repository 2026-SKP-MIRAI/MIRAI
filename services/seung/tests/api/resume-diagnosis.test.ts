import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    resume: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

import { GET } from '@/app/api/resume/diagnosis/route'

function makeRequest(resumeId?: string): NextRequest {
  return {
    nextUrl: {
      searchParams: {
        get: (key: string) => (key === 'resumeId' ? (resumeId ?? null) : null),
      },
    },
  } as unknown as NextRequest
}

const mockDiagnosisResult = {
  scores: {
    specificity: 72,
    achievementClarity: 65,
    logicStructure: 80,
    roleAlignment: 88,
    differentiation: 60,
  },
  strengths: ['논리 구조 명확', '직무 적합성 높음'],
  weaknesses: ['수치 근거 부족', '차별성 낮음'],
  suggestions: [
    { section: '성장 경험', issue: '수치 없음', suggestion: '구체적 수치 추가 권장' },
  ],
}

describe('GET /api/resume/diagnosis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resumeId 없으면 400 반환', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('Resume 없으면 404 반환', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce(null)
    const res = await GET(makeRequest('not-exist'))
    expect(res.status).toBe(404)
  })

  it('diagnosisResult null이면 404 반환', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce({
      id: 'resume-1',
      diagnosisResult: null,
    })
    const res = await GET(makeRequest('resume-1'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('diagnosisResult 있으면 200 + 결과 반환', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce({
      id: 'resume-1',
      diagnosisResult: mockDiagnosisResult,
    })
    const res = await GET(makeRequest('resume-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.scores.specificity).toBe(72)
    expect(body.strengths).toHaveLength(2)
    expect(body.suggestions).toHaveLength(1)
  })

  it('DB 오류 시 500 반환', async () => {
    mockPrisma.resume.findUnique.mockRejectedValueOnce(new Error('DB error'))
    const res = await GET(makeRequest('resume-1'))
    expect(res.status).toBe(500)
  })
})
