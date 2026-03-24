import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockPrisma, mockCreateClient } = vi.hoisted(() => ({
  mockPrisma: {
    resume: {
      findUnique: vi.fn(),
    },
    interviewSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

const mockFetch = vi.fn()
global.fetch = mockFetch

import { POST } from '@/app/api/interview/answer/route'

function makeRequest(body: Record<string, unknown>): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest
}

const mockSession = {
  id: 'session-1',
  userId: 'user-1',
  resumeId: 'resume-1',
  currentQuestion: '자기소개를 해주세요.',
  currentPersona: 'hr',
  currentPersonaLabel: 'HR 면접관',
  currentQuestionType: 'main',
  sessionComplete: false,
  history: [],
  questionsQueue: [{ persona: 'tech_lead', type: 'main' }],
  interviewMode: 'real',
  updatedAt: new Date('2024-01-01T00:00:00Z'),
}

describe('POST /api/interview/answer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENGINE_BASE_URL = 'http://localhost:8000'
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    })
  })

  it('성공: nextQuestion 반환', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(mockSession)
    mockPrisma.resume.findUnique.mockResolvedValueOnce({ resumeText: '자소서' })

    const engineData = {
      nextQuestion: {
        persona: 'tech_lead',
        personaLabel: '기술 리드',
        question: '기술 스택을 설명해주세요.',
        type: 'main',
      },
      updatedQueue: [],
      sessionComplete: false,
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => engineData,
    })
    mockPrisma.interviewSession.update.mockResolvedValueOnce({})

    const response = await POST(
      makeRequest({ sessionId: 'session-1', answer: '저는 개발자입니다.' })
    )
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.nextQuestion.persona).toBe('tech_lead')
    expect(body.sessionComplete).toBe(false)
  })

  it('꼬리질문: type="follow_up" 반환', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(mockSession)
    mockPrisma.resume.findUnique.mockResolvedValueOnce({ resumeText: '자소서' })

    const engineData = {
      nextQuestion: {
        persona: 'hr',
        personaLabel: 'HR 면접관',
        question: '좀 더 구체적으로 설명해주세요.',
        type: 'follow_up',
      },
      updatedQueue: [{ persona: 'tech_lead', type: 'main' }],
      sessionComplete: false,
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => engineData,
    })
    mockPrisma.interviewSession.update.mockResolvedValueOnce({})

    const response = await POST(
      makeRequest({ sessionId: 'session-1', answer: '답변' })
    )
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.nextQuestion.type).toBe('follow_up')
  })

  it('세션 완료: sessionComplete=true, nextQuestion=null', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(mockSession)
    mockPrisma.resume.findUnique.mockResolvedValueOnce({ resumeText: '자소서' })

    const engineData = {
      nextQuestion: null,
      updatedQueue: [],
      sessionComplete: true,
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => engineData,
    })
    mockPrisma.interviewSession.update.mockResolvedValueOnce({})

    const response = await POST(
      makeRequest({ sessionId: 'session-1', answer: '마지막 답변' })
    )
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.nextQuestion).toBeNull()
    expect(body.sessionComplete).toBe(true)
  })

  it('sessionId 누락 시 400 반환', async () => {
    const response = await POST(makeRequest({ answer: '답변' }))
    expect(response.status).toBe(400)
  })

  it('빈 답변(공백만) 시 400 반환 — DB 조회 없이 즉시 거절', async () => {
    const response = await POST(
      makeRequest({ sessionId: 'session-1', answer: '   \n  ' })
    )
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('답변')
    expect(mockPrisma.interviewSession.findUnique).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('빈 문자열 답변 시 400 반환 — DB 조회 없이 즉시 거절', async () => {
    const response = await POST(makeRequest({ sessionId: 'session-1', answer: '' }))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('답변')
    expect(mockPrisma.interviewSession.findUnique).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('5000자 초과 답변은 5000자로 잘라서 엔진에 전달', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(mockSession)
    mockPrisma.resume.findUnique.mockResolvedValueOnce({ resumeText: '자소서' })

    const engineData = {
      nextQuestion: { persona: 'hr', personaLabel: 'HR 면접관', question: '다음 질문', type: 'main' },
      updatedQueue: [],
      sessionComplete: false,
    }
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => engineData })
    mockPrisma.interviewSession.update.mockResolvedValueOnce({})

    const longAnswer = 'a'.repeat(5001)
    const response = await POST(makeRequest({ sessionId: 'session-1', answer: longAnswer }))
    expect(response.status).toBe(200)

    const [, options] = mockFetch.mock.calls[0] as [string, { body: string }]
    const requestBody = JSON.parse(options.body)
    expect(requestBody.currentAnswer.length).toBe(5000)
  })

  it('세션 없으면 404 반환', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(null)

    const response = await POST(
      makeRequest({ sessionId: 'nonexistent', answer: '답변' })
    )
    expect(response.status).toBe(404)
  })

  it('이미 완료된 세션에 답변 시 400 반환', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce({
      ...mockSession,
      sessionComplete: true,
    })

    const response = await POST(
      makeRequest({ sessionId: 'session-1', answer: '답변' })
    )
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('완료')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('미인증 시 401 반환', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })
    const response = await POST(makeRequest({ sessionId: 'session-1', answer: '답변' }))
    expect(response.status).toBe(401)
    expect(mockPrisma.interviewSession.findUnique).not.toHaveBeenCalled()
  })

  it('타인 세션 접근 시 403 반환', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce({
      ...mockSession,
      userId: 'other-user',
    })
    const response = await POST(makeRequest({ sessionId: 'session-1', answer: '답변' }))
    expect(response.status).toBe(403)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('엔진 에러 시 500 + generic 메시지 반환 (내부 에러 미노출)', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(mockSession)
    mockPrisma.resume.findUnique.mockResolvedValueOnce({ resumeText: '자소서' })

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'LLM 오류' }),
    })

    const response = await POST(
      makeRequest({ sessionId: 'session-1', answer: '답변' })
    )
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('서버 오류가 발생했습니다.')
    expect(body.detail).toBeUndefined()
  })
})
