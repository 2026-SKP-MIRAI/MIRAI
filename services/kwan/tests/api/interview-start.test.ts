// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import mockStartResponse from '../fixtures/input/mock_interview_start_response.json'

vi.mock('@/lib/engine-client', () => ({
  callEngineStart: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    resume: {
      findUnique: vi.fn(),
    },
    interviewSession: {
      create: vi.fn(),
    },
  },
}))

import { POST } from '@/app/api/interview/start/route'
import { callEngineStart } from '@/lib/engine-client'
import { prisma } from '@/lib/db'

const mockCallStart = vi.mocked(callEngineStart)

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
  })

  it('resumeId 없음 → 400', async () => {
    const req = makeRequest({})
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('resumeId가 DB에 없음 → 404', async () => {
    vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce(null)
    const req = makeRequest({ resumeId: 'nonexistent' })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('정상 흐름: resumeId 있음 → session 생성 + firstQuestion 반환', async () => {
    vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce(MOCK_RESUME as ReturnType<typeof prisma.resume.findUnique> extends Promise<infer T> ? T : never)
    mockCallStart.mockResolvedValueOnce(
      new Response(JSON.stringify(mockStartResponse), { status: 200 })
    )
    vi.mocked(prisma.interviewSession.create).mockResolvedValueOnce(MOCK_SESSION as ReturnType<typeof prisma.interviewSession.create> extends Promise<infer T> ? T : never)

    const req = makeRequest({ resumeId: 'resume-123' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sessionId).toBe('session-456')
    expect(body.firstQuestion.persona).toBe('hr')
    expect(body.firstQuestion.question).toBe(mockStartResponse.firstQuestion.question)
  })

  it('엔진 호출 실패 → 500', async () => {
    vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce(MOCK_RESUME as ReturnType<typeof prisma.resume.findUnique> extends Promise<infer T> ? T : never)
    mockCallStart.mockRejectedValueOnce(new Error('engine down'))
    const req = makeRequest({ resumeId: 'resume-123' })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it('엔진 500 응답 → 500 전달', async () => {
    vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce(MOCK_RESUME as ReturnType<typeof prisma.resume.findUnique> extends Promise<infer T> ? T : never)
    mockCallStart.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'LLM 오류' }), { status: 500 })
    )
    const req = makeRequest({ resumeId: 'resume-123' })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
