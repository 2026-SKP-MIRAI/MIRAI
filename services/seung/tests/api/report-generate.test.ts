import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    interviewSession: { findUnique: vi.fn() },
    report: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

const mockFetch = vi.fn()
global.fetch = mockFetch

import { POST } from '@/app/api/report/generate/route'

function makeRequest(body: Record<string, unknown>): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest
}

const mockSession = {
  id: 'session-1',
  sessionComplete: true,
  history: [
    {
      persona: 'hr',
      personaLabel: 'HR 면접관',
      question: '자기소개를 해주세요.',
      answer: '저는 개발자입니다.',
      questionType: 'main',
    },
  ],
  resume: { resumeText: '자소서 내용입니다.' },
  interviewMode: 'real',
}

const mockEngineResponse = {
  totalScore: 78.5,
  scores: {
    communication: 80,
    problemSolving: 75,
    logicalThinking: 82,
    jobExpertise: 70,
    cultureFit: 85,
    leadership: 72,
    creativity: 78,
    sincerity: 88,
  },
  summary: '전반적으로 우수한 역량을 보여주었습니다.',
  axisFeedbacks: [
    {
      axis: 'communication',
      axisLabel: '의사소통',
      score: 80,
      type: 'strength',
      feedback: '명확한 의사소통 능력을 보여주었습니다.',
    },
  ],
}

describe('POST /api/report/generate', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.ENGINE_BASE_URL = 'http://localhost:8000'
  })

  afterEach(() => {
    process.env.ENGINE_BASE_URL = 'http://localhost:8000'
  })

  it('성공: sessionComplete=true → 엔진 호출 → report.create → { reportId } (201)', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(mockSession)
    mockPrisma.report.findFirst.mockResolvedValueOnce(null)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockEngineResponse,
    })
    mockPrisma.report.create.mockResolvedValueOnce({ id: 'report-1' })

    const response = await POST(makeRequest({ sessionId: 'session-1' }))
    expect(response.status).toBe(201)

    const body = await response.json()
    expect(body.reportId).toBe('report-1')
    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockPrisma.report.create).toHaveBeenCalledOnce()
  })

  it('sessionId 누락 → 400', async () => {
    const response = await POST(makeRequest({}))
    expect(response.status).toBe(400)
    expect(mockPrisma.interviewSession.findUnique).not.toHaveBeenCalled()
  })

  it('ENGINE_BASE_URL 없음 → 500', async () => {
    delete process.env.ENGINE_BASE_URL

    const response = await POST(makeRequest({ sessionId: 'session-1' }))
    expect(response.status).toBe(500)
  })

  it('세션 없음 → 404', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(null)

    const response = await POST(makeRequest({ sessionId: 'nonexistent' }))
    expect(response.status).toBe(404)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('sessionComplete=false → 400 "면접이 아직 완료되지 않았습니다."', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce({
      ...mockSession,
      sessionComplete: false,
    })

    const response = await POST(makeRequest({ sessionId: 'session-1' }))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('면접이 아직 완료되지 않았습니다.')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('기존 Report 있음 → findFirst hit → 기존 reportId (200), mockFetch 미호출', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(mockSession)
    mockPrisma.report.findFirst.mockResolvedValueOnce({ id: 'existing-report-1' })

    const response = await POST(makeRequest({ sessionId: 'session-1' }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.reportId).toBe('existing-report-1')
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockPrisma.report.create).not.toHaveBeenCalled()
  })

  it('엔진 422 → 서비스 422', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(mockSession)
    mockPrisma.report.findFirst.mockResolvedValueOnce(null)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ detail: '답변 부족' }),
    })

    const response = await POST(makeRequest({ sessionId: 'session-1' }))
    expect(response.status).toBe(422)
    const body = await response.json()
    expect(body.error).toBe('답변이 부족합니다. 더 많은 질문에 답변해 주세요.')
  })

  it('엔진 500 → 서비스 500', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(mockSession)
    mockPrisma.report.findFirst.mockResolvedValueOnce(null)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: '엔진 오류' }),
    })

    const response = await POST(makeRequest({ sessionId: 'session-1' }))
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('서버 오류가 발생했습니다.')
  })

  it('report.create P2002 → findUnique fallback → 기존 reportId (200)', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(mockSession)
    mockPrisma.report.findFirst.mockResolvedValueOnce(null)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockEngineResponse,
    })
    const p2002Error = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    mockPrisma.report.create.mockRejectedValueOnce(p2002Error)
    mockPrisma.report.findUnique.mockResolvedValueOnce({ id: 'race-report-1' })

    const response = await POST(makeRequest({ sessionId: 'session-1' }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.reportId).toBe('race-report-1')
  })
})
