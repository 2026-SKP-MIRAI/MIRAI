// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import mockAnswerResponse from '../fixtures/input/mock_interview_answer_response.json'

const { mockCallEngineAnswer, mockPrisma, mockCreateClient, mockCookies } = vi.hoisted(() => ({
  mockCallEngineAnswer: vi.fn(),
  mockCreateClient: vi.fn(),
  mockCookies: vi.fn(),
  mockPrisma: {
    interviewSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/engine-client', () => ({
  callEngineAnswer: mockCallEngineAnswer,
}))

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('next/headers', () => ({ cookies: mockCookies }))

import { POST } from '@/app/api/interview/answer/route'

const MOCK_SESSION = {
  id: 'session-456',
  userId: 'user-1',
  resumeId: 'resume-123',
  questionsQueue: [
    { persona: 'tech_lead', type: 'main' },
    { persona: 'executive', type: 'main' },
  ],
  history: [],
  currentQuestion: '자기소개를 해주세요.',
  currentPersona: 'hr',
  currentPersonaLabel: 'HR 담당자',
  currentQuestionType: 'main',
  sessionComplete: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  resume: {
    id: 'resume-123',
    resumeText: '저는 5년 경력의 소프트웨어 엔지니어입니다.',
    questions: [],
    createdAt: new Date(),
  },
}

function makeRequest(body: object): Request {
  return {
    json: () => Promise.resolve(body),
  } as unknown as Request
}

describe('POST /api/interview/answer', () => {
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
    mockPrisma.interviewSession.update.mockResolvedValue(MOCK_SESSION)
    mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) })
  })

  it('sessionId 없음 → 400', async () => {
    const req = makeRequest({ answer: '안녕하세요.' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('answer 없음 → 400', async () => {
    const req = makeRequest({ sessionId: 'session-456' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('answer 공백만 → 400', async () => {
    const req = makeRequest({ sessionId: 'session-456', answer: '   ' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('session 없음 → 404', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(null)
    const req = makeRequest({ sessionId: 'nonexistent', answer: '답변' })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('이미 완료된 session → 400 반환 (엔진 미호출)', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce({
      ...MOCK_SESSION,
      sessionComplete: true,
    })
    const req = makeRequest({ sessionId: 'session-456', answer: '답변' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(mockCallEngineAnswer).not.toHaveBeenCalled()
  })

  it('정상 흐름: session 업데이트 + nextQuestion 반환', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(MOCK_SESSION)
    mockCallEngineAnswer.mockResolvedValueOnce(
      new Response(JSON.stringify(mockAnswerResponse), { status: 200 })
    )
    const req = makeRequest({ sessionId: 'session-456', answer: '저는 소프트웨어 엔지니어입니다.' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.nextQuestion.persona).toBe(mockAnswerResponse.nextQuestion.persona)
    expect(body.sessionComplete).toBe(false)
    expect(mockPrisma.interviewSession.update).toHaveBeenCalledTimes(1)
  })

  it('sessionComplete=true 응답 → 완료 응답 반환', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(MOCK_SESSION)
    mockCallEngineAnswer.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ nextQuestion: null, updatedQueue: [], sessionComplete: true }),
        { status: 200 }
      )
    )
    const req = makeRequest({ sessionId: 'session-456', answer: '마지막 답변입니다.' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sessionComplete).toBe(true)
  })

  it('엔진 호출 실패 → 500', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(MOCK_SESSION)
    mockCallEngineAnswer.mockRejectedValueOnce(new Error('engine down'))
    const req = makeRequest({ sessionId: 'session-456', answer: '답변' })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it('동시 완료 충돌(P2025) → 400 반환', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(MOCK_SESSION)
    mockCallEngineAnswer.mockResolvedValueOnce(
      new Response(JSON.stringify(mockAnswerResponse), { status: 200 })
    )
    mockPrisma.interviewSession.update.mockRejectedValueOnce({ code: 'P2025' })
    const req = makeRequest({ sessionId: 'session-456', answer: '답변' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('이미 완료된 면접 세션입니다.')
  })

  it('should return 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })
    const req = makeRequest({ sessionId: 'session-456', answer: '답변' })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('로그인이 필요합니다.')
  })

  it('should return 403 when accessing other user session', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce({
      ...MOCK_SESSION,
      userId: 'other-user',
    })
    const req = makeRequest({ sessionId: 'session-456', answer: '답변' })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('접근 권한이 없습니다.')
  })
})
