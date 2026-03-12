// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import mockAnswerResponse from '../fixtures/input/mock_interview_answer_response.json'

vi.mock('@/lib/engine-client', () => ({
  callEngineAnswer: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    interviewSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { POST } from '@/app/api/interview/answer/route'
import { callEngineAnswer } from '@/lib/engine-client'
import { prisma } from '@/lib/db'

const mockCallAnswer = vi.mocked(callEngineAnswer)

const MOCK_SESSION = {
  id: 'session-456',
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
    vi.mocked(prisma.interviewSession.update).mockResolvedValue(MOCK_SESSION as ReturnType<typeof prisma.interviewSession.update> extends Promise<infer T> ? T : never)
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
    vi.mocked(prisma.interviewSession.findUnique).mockResolvedValueOnce(null)
    const req = makeRequest({ sessionId: 'nonexistent', answer: '답변' })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('이미 완료된 session → 400 반환 (엔진 미호출)', async () => {
    vi.mocked(prisma.interviewSession.findUnique).mockResolvedValueOnce({
      ...MOCK_SESSION,
      sessionComplete: true,
    } as ReturnType<typeof prisma.interviewSession.findUnique> extends Promise<infer T> ? T : never)
    const req = makeRequest({ sessionId: 'session-456', answer: '답변' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(mockCallAnswer).not.toHaveBeenCalled()
  })

  it('정상 흐름: session 업데이트 + nextQuestion 반환', async () => {
    vi.mocked(prisma.interviewSession.findUnique).mockResolvedValueOnce(MOCK_SESSION as ReturnType<typeof prisma.interviewSession.findUnique> extends Promise<infer T> ? T : never)
    mockCallAnswer.mockResolvedValueOnce(
      new Response(JSON.stringify(mockAnswerResponse), { status: 200 })
    )
    const req = makeRequest({ sessionId: 'session-456', answer: '저는 소프트웨어 엔지니어입니다.' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.nextQuestion.persona).toBe(mockAnswerResponse.nextQuestion.persona)
    expect(body.sessionComplete).toBe(false)
    expect(vi.mocked(prisma.interviewSession.update)).toHaveBeenCalledTimes(1)
  })

  it('sessionComplete=true 응답 → 완료 응답 반환', async () => {
    vi.mocked(prisma.interviewSession.findUnique).mockResolvedValueOnce(MOCK_SESSION as ReturnType<typeof prisma.interviewSession.findUnique> extends Promise<infer T> ? T : never)
    mockCallAnswer.mockResolvedValueOnce(
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
    vi.mocked(prisma.interviewSession.findUnique).mockResolvedValueOnce(MOCK_SESSION as ReturnType<typeof prisma.interviewSession.findUnique> extends Promise<infer T> ? T : never)
    mockCallAnswer.mockRejectedValueOnce(new Error('engine down'))
    const req = makeRequest({ sessionId: 'session-456', answer: '답변' })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
