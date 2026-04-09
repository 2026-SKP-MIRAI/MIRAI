// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import mockStartResponse from '../fixtures/input/mock_interview_start_response.json'

const { mockCallEngineStart, mockPrisma, mockCreateClient, mockCookies } = vi.hoisted(() => ({
  mockCallEngineStart: vi.fn(),
  mockCreateClient: vi.fn(),
  mockCookies: vi.fn(),
  mockPrisma: {
    resume: {
      findUnique: vi.fn(),
    },
    interviewSession: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/engine-client', () => ({
  callEngineStart: mockCallEngineStart,
}))

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('next/headers', () => ({ cookies: mockCookies }))

import { POST } from '@/app/api/interview/start/route'

const MOCK_RESUME = {
  id: 'resume-123',
  resumeText: '저는 5년 경력의 소프트웨어 엔지니어입니다.',
  questions: [],
  createdAt: new Date(),
}

const MOCK_SESSION = {
  id: 'session-456',
  resumeId: 'resume-123',
  questionsQueue: mockStartResponse.questionsQueue,
  history: [],
  currentQuestion: mockStartResponse.firstQuestion.question,
  currentPersona: mockStartResponse.firstQuestion.persona,
  currentPersonaLabel: mockStartResponse.firstQuestion.personaLabel,
  currentQuestionType: mockStartResponse.firstQuestion.type,
  sessionComplete: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function makeRequest(body: object): Request {
  return {
    json: () => Promise.resolve(body),
  } as unknown as Request
}

describe('POST /api/interview/start', () => {
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
    // 기본: 게스트 쿠키 없음
    mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) })
  })

  it('resumeId 없음 → 400', async () => {
    const req = makeRequest({})
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('resumeId가 DB에 없음 → 404', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce(null)
    const req = makeRequest({ resumeId: 'nonexistent' })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('정상 흐름: resumeId 있음 → session 생성 + firstQuestion 반환', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce(MOCK_RESUME)
    mockCallEngineStart.mockResolvedValueOnce(
      new Response(JSON.stringify(mockStartResponse), { status: 200 })
    )
    mockPrisma.interviewSession.create.mockResolvedValueOnce(MOCK_SESSION)

    const req = makeRequest({ resumeId: 'resume-123' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sessionId).toBe('session-456')
    expect(body.firstQuestion.persona).toBe('hr')
    expect(body.firstQuestion.question).toBe(mockStartResponse.firstQuestion.question)
  })

  it('DB lookup 실패 → 500', async () => {
    mockPrisma.resume.findUnique.mockRejectedValueOnce(new Error('DB connection failed'))
    const req = makeRequest({ resumeId: 'resume-123' })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('DB session create 실패 → 500', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce(MOCK_RESUME)
    mockCallEngineStart.mockResolvedValueOnce(
      new Response(JSON.stringify(mockStartResponse), { status: 200 })
    )
    mockPrisma.interviewSession.create.mockRejectedValueOnce(new Error('DB connection failed'))
    const req = makeRequest({ resumeId: 'resume-123' })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('엔진 호출 실패 → 500', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce(MOCK_RESUME)
    mockCallEngineStart.mockRejectedValueOnce(new Error('engine down'))
    const req = makeRequest({ resumeId: 'resume-123' })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it('엔진 500 응답 → 500 전달', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce(MOCK_RESUME)
    mockCallEngineStart.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'LLM 오류' }), { status: 500 })
    )
    const req = makeRequest({ resumeId: 'resume-123' })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it("mode='practice' → interviewMode='practice' 저장", async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce(MOCK_RESUME)
    mockCallEngineStart.mockResolvedValueOnce(
      new Response(JSON.stringify(mockStartResponse), { status: 200 })
    )
    mockPrisma.interviewSession.create.mockResolvedValueOnce({
      ...MOCK_SESSION,
      interviewMode: 'practice',
    })

    const req = makeRequest({ resumeId: 'resume-123', mode: 'practice' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockPrisma.interviewSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ interviewMode: 'practice' }),
      })
    )
  })

  it("mode 미제공 → interviewMode='real' 기본값", async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce(MOCK_RESUME)
    mockCallEngineStart.mockResolvedValueOnce(
      new Response(JSON.stringify(mockStartResponse), { status: 200 })
    )
    mockPrisma.interviewSession.create.mockResolvedValueOnce(MOCK_SESSION)

    const req = makeRequest({ resumeId: 'resume-123' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockPrisma.interviewSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ interviewMode: 'real' }),
      })
    )
  })

  it('should return 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })
    const req = makeRequest({ resumeId: 'resume-123' })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('로그인이 필요합니다.')
  })

  it('비회원 모드(__guest=1): 인증 없이 면접 시작 → 200', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })
    mockCookies.mockResolvedValueOnce({ get: vi.fn().mockReturnValue({ value: '1' }) })
    mockPrisma.resume.findUnique.mockResolvedValueOnce({ ...MOCK_RESUME, userId: null })
    mockCallEngineStart.mockResolvedValueOnce(
      new Response(JSON.stringify(mockStartResponse), { status: 200 })
    )
    mockPrisma.interviewSession.create.mockResolvedValueOnce(MOCK_SESSION)

    const req = makeRequest({ resumeId: 'resume-123' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sessionId).toBe('session-456')
  })

  it('비회원 모드: session create 시 userId=null로 저장', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })
    mockCookies.mockResolvedValueOnce({ get: vi.fn().mockReturnValue({ value: '1' }) })
    mockPrisma.resume.findUnique.mockResolvedValueOnce({ ...MOCK_RESUME, userId: null })
    mockCallEngineStart.mockResolvedValueOnce(
      new Response(JSON.stringify(mockStartResponse), { status: 200 })
    )
    mockPrisma.interviewSession.create.mockResolvedValueOnce(MOCK_SESSION)

    const req = makeRequest({ resumeId: 'resume-123' })
    await POST(req)
    expect(mockPrisma.interviewSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: null }),
      })
    )
  })

  it('totalQuestions 반환 확인', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce(MOCK_RESUME)
    mockCallEngineStart.mockResolvedValueOnce(
      new Response(JSON.stringify(mockStartResponse), { status: 200 })
    )
    mockPrisma.interviewSession.create.mockResolvedValueOnce(MOCK_SESSION)

    const req = makeRequest({ resumeId: 'resume-123' })
    const res = await POST(req)
    const body = await res.json()
    expect(typeof body.totalQuestions).toBe('number')
    expect(body.totalQuestions).toBe(mockStartResponse.questionsQueue.length + 1)
  })

  it('should return 403 when resume belongs to another user', async () => {
    mockPrisma.resume.findUnique.mockResolvedValueOnce({
      ...MOCK_RESUME,
      userId: 'other-user',
    })
    const req = makeRequest({ resumeId: 'resume-123' })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('접근 권한이 없습니다.')
  })
})
