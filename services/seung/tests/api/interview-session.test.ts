import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockPrisma, mockCreateClient } = vi.hoisted(() => ({
  mockPrisma: {
    interviewSession: {
      findUnique: vi.fn(),
    },
  },
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { GET } from '@/app/api/interview/session/route'

function makeRequest(sessionId?: string): NextRequest {
  return {
    nextUrl: {
      searchParams: {
        get: (key: string) => (key === 'sessionId' ? (sessionId ?? null) : null),
      },
    },
  } as unknown as NextRequest
}

const mockSession = {
  userId: 'user-1',
  currentQuestion: '자기소개를 해주세요.',
  currentPersona: 'hr',
  currentPersonaLabel: 'HR 면접관',
  currentQuestionType: 'main',
  history: [],
  questionsQueue: [{ persona: 'tech_lead', type: 'main' }, { persona: 'executive', type: 'main' }],
  sessionComplete: false,
  interviewMode: 'real',
}

describe('GET /api/interview/session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    })
  })

  it('성공: 세션 정보 반환', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(mockSession)
    const response = await GET(makeRequest('session-1'))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.currentQuestion).toBe('자기소개를 해주세요.')
    expect(body.currentPersona).toBe('hr')
    expect(body.sessionComplete).toBe(false)
    // history=0, queue=2, sessionComplete=false → totalQuestions=3
    expect(body.totalQuestions).toBe(3)
  })

  it('sessionId 누락 시 400 반환', async () => {
    const response = await GET(makeRequest())
    expect(response.status).toBe(400)
    expect(mockPrisma.interviewSession.findUnique).not.toHaveBeenCalled()
  })

  it('세션 없으면 404 반환', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(null)
    const response = await GET(makeRequest('nonexistent'))
    expect(response.status).toBe(404)
  })

  it('미인증 시 401 반환', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })
    const response = await GET(makeRequest('session-1'))
    expect(response.status).toBe(401)
    expect(mockPrisma.interviewSession.findUnique).not.toHaveBeenCalled()
  })

  it('타인 세션 접근 시 403 반환', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce({
      ...mockSession,
      userId: 'other-user',
    })
    const response = await GET(makeRequest('session-1'))
    expect(response.status).toBe(403)
  })

  it('DB 오류 시 500 반환', async () => {
    mockPrisma.interviewSession.findUnique.mockRejectedValueOnce(new Error('DB error'))
    const response = await GET(makeRequest('session-1'))
    expect(response.status).toBe(500)
  })
})
