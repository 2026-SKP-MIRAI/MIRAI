import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    resume: {
      findUnique: vi.fn(),
    },
    interviewSession: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

const mockFetch = vi.fn()
global.fetch = mockFetch

import { POST } from '@/app/api/interview/start/route'

function makeRequest(body: Record<string, unknown>): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest
}

describe('POST /api/interview/start', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENGINE_BASE_URL = 'http://localhost:8000'
  })

  it('성공: sessionId + firstQuestion 반환', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce({
      resumeText: '자소서 텍스트',
    })

    const engineData = {
      firstQuestion: {
        persona: 'hr',
        personaLabel: 'HR 면접관',
        question: '자기소개를 해주세요.',
        type: 'main',
      },
      questionsQueue: [
        { persona: 'tech_lead', type: 'main' },
        { persona: 'executive', type: 'main' },
      ],
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => engineData,
    })

    mockPrisma.interviewSession.create.mockResolvedValueOnce({
      id: 'session-123',
    })

    const response = await POST(makeRequest({ resumeId: 'resume-1' }))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.sessionId).toBe('session-123')
    expect(body.firstQuestion.persona).toBe('hr')
    expect(body.firstQuestion.question).toBe('자기소개를 해주세요.')
  })

  it('resumeId 누락 시 400 반환', async () => {
    const response = await POST(makeRequest({}))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('resumeId')
  })

  it('Resume 없으면 404 반환', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce(null)

    const response = await POST(makeRequest({ resumeId: 'nonexistent' }))
    expect(response.status).toBe(404)
  })

  it('엔진 에러 시 500 + generic 메시지 반환 (내부 에러 미노출)', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce({
      resumeText: '자소서 텍스트',
    })

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'LLM 오류' }),
    })

    const response = await POST(makeRequest({ resumeId: 'resume-1' }))
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('서버 오류가 발생했습니다.')
    expect(body.detail).toBeUndefined()
  })

  it('ENGINE_BASE_URL 미설정 시 500 반환', async () => {
    delete process.env.ENGINE_BASE_URL

    mockPrisma.resume.findUnique.mockResolvedValueOnce({
      resumeText: '자소서 텍스트',
    })

    const response = await POST(makeRequest({ resumeId: 'resume-1' }))
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toContain('서버 설정')
  })

  it('interviewMode="practice" 전달 시 create 호출에 반영', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce({
      resumeText: '자소서 텍스트',
    })

    const engineData = {
      firstQuestion: {
        persona: 'hr',
        personaLabel: 'HR 면접관',
        question: '자기소개를 해주세요.',
        type: 'main',
      },
      questionsQueue: [],
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => engineData,
    })

    mockPrisma.interviewSession.create.mockResolvedValueOnce({
      id: 'session-practice-1',
    })

    const response = await POST(makeRequest({ resumeId: 'resume-1', interviewMode: 'practice' }))
    expect(response.status).toBe(200)

    expect(mockPrisma.interviewSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ interviewMode: 'practice' }),
      })
    )
  })
})
