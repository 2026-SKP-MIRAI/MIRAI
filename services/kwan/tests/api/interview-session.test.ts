// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    interviewSession: {
      findUnique: vi.fn(),
    },
  },
}))

import { GET } from '@/app/api/interview/session/route'
import { prisma } from '@/lib/db'

const MOCK_SESSION = {
  id: 'session-id-123',
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
  })

  it('sessionId 없음 → 400', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('sessionId가 필요합니다.')
  })

  it('sessionId가 DB에 없음 → 404', async () => {
    vi.mocked(prisma.interviewSession.findUnique).mockResolvedValueOnce(null)
    const res = await GET(makeRequest('non-existent-id'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('세션을 찾을 수 없습니다.')
  })

  it('정상 흐름: 세션 상태 전체 반환', async () => {
    vi.mocked(prisma.interviewSession.findUnique).mockResolvedValueOnce(
      MOCK_SESSION as ReturnType<typeof prisma.interviewSession.findUnique> extends Promise<infer T> ? T : never
    )
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
    vi.mocked(prisma.interviewSession.findUnique).mockRejectedValueOnce(new Error('DB connection failed'))
    const res = await GET(makeRequest('session-id-123'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('sessionComplete=true 세션 → 완료 상태 반환', async () => {
    vi.mocked(prisma.interviewSession.findUnique).mockResolvedValueOnce(
      { ...MOCK_SESSION, sessionComplete: true, currentQuestion: '' } as ReturnType<typeof prisma.interviewSession.findUnique> extends Promise<infer T> ? T : never
    )
    const res = await GET(makeRequest('session-id-123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sessionComplete).toBe(true)
  })
})
