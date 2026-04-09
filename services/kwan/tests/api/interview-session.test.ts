// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPrisma, mockCreateClient, mockCookies } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockCookies: vi.fn(),
  mockPrisma: {
    interviewSession: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('next/headers', () => ({ cookies: mockCookies }))

import { GET } from '@/app/api/interview/session/route'

const MOCK_SESSION = {
  id: 'session-id-123',
  userId: 'user-1',
  resumeId: 'resume-id-456',
  history: [{ persona: 'hr', personaLabel: 'HR 담당자', question: '자기소개', answer: '안녕하세요', questionType: 'main' }],
  currentQuestion: '지원 동기가 무엇인가요?',
  currentPersona: 'tech_lead',
  currentPersonaLabel: '기술팀장',
  currentQuestionType: 'main',
  questionsQueue: [],
  sessionComplete: false,
  interviewMode: 'real',
  createdAt: new Date(),
  updatedAt: new Date(),
}

function makeRequest(sessionId?: string): Request {
  const url = sessionId
    ? `http://localhost/api/interview/session?sessionId=${sessionId}`
    : `http://localhost/api/interview/session`
  return { url } as unknown as Request
}

describe('GET /api/interview/session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
    })
    mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) })
  })

  it('sessionId 없음 → 400', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('sessionId가 필요합니다.')
  })

  it('sessionId가 DB에 없음 → 404', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(null)
    const res = await GET(makeRequest('non-existent-id'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('세션을 찾을 수 없습니다.')
  })

  it('정상 흐름: 세션 상태 전체 반환', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(MOCK_SESSION)
    const res = await GET(makeRequest('session-id-123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sessionId).toBe('session-id-123')
    expect(body.currentQuestion).toBe('지원 동기가 무엇인가요?')
    expect(body.currentPersona).toBe('tech_lead')
    expect(body.currentPersonaLabel).toBe('기술팀장')
    expect(body.currentQuestionType).toBe('main')
    expect(body.sessionComplete).toBe(false)
    expect(body.history).toHaveLength(1)
    expect(body.interviewMode).toBe('real')
  })

  it('DB lookup 실패 → 500', async () => {
    mockPrisma.interviewSession.findUnique.mockRejectedValueOnce(new Error('DB connection failed'))
    const res = await GET(makeRequest('session-id-123'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('sessionComplete=true 세션 → 완료 상태 반환', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(
      { ...MOCK_SESSION, sessionComplete: true, currentQuestion: '' }
    )
    const res = await GET(makeRequest('session-id-123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sessionComplete).toBe(true)
  })

  it('should return 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })
    const res = await GET(makeRequest('session-id-123'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('로그인이 필요합니다.')
  })

  it('should return 403 when accessing other user session', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce({
      ...MOCK_SESSION,
      userId: 'other-user',
    })
    const res = await GET(makeRequest('session-id-123'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('접근 권한이 없습니다.')
  })
})
