import { describe, it, expect, vi, beforeEach } from 'vitest'

// interviewService mock
vi.mock('@/lib/interview/interview-service', () => ({
  interviewService: {
    answerStream: vi.fn(),
  },
}))

// interviewRepository mock
vi.mock('@/lib/interview/interview-repository', () => ({
  interviewRepository: {
    findById: vi.fn(),
    saveEngineResult: vi.fn().mockResolvedValue(undefined),
    updateAfterAnswer: vi.fn().mockResolvedValue(undefined),
  },
}))

// supabase/server mock
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  })),
}))

// next/headers mock
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}))

// @prisma/client mock
vi.mock('@prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {
      code: string
      constructor(msg: string, opts: { code: string }) {
        super(msg)
        this.code = opts.code
      }
    },
    DbNull: null,
  },
}))

import { interviewService } from '@/lib/interview/interview-service'
import { interviewRepository } from '@/lib/interview/interview-repository'
import { POST } from '../route'

const mockAnswerStream = vi.mocked(interviewService.answerStream)
const mockFindById = vi.mocked(interviewRepository.findById)
const mockSaveEngineResult = vi.mocked(interviewRepository.saveEngineResult)
const mockUpdateAfterAnswer = vi.mocked(interviewRepository.updateAfterAnswer)

function makeSSEStream(events: object[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const chunks = events.map(e => encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })
}

const mockSession = {
  id: 'session-1',
  userId: 'user-1',
  resumeText: '테스트 이력서',
  currentQuestion: '자기소개를 해주세요.',
  currentPersona: 'hr',
  currentQuestionType: 'main' as const,
  questionsQueue: [],
  history: [],
  sessionComplete: false,
  engineResultCache: null,
  reportJson: null,
}

describe('POST /api/interview/answer (drain pattern)', () => {
  beforeEach(() => {
    mockAnswerStream.mockReset()
    mockFindById.mockReset()
    mockSaveEngineResult.mockReset()
    mockUpdateAfterAnswer.mockReset()
    mockFindById.mockResolvedValue(mockSession)
    mockSaveEngineResult.mockResolvedValue(undefined)
    mockUpdateAfterAnswer.mockResolvedValue(undefined)
  })

  it('SSE 스트림을 클라이언트에 파스스루하고 done 이벤트로 DB를 업데이트한다', async () => {
    const donePayload = {
      nextQuestion: { question: '다음 질문', persona: 'hr', personaLabel: 'HR 담당자', type: 'main' },
      updatedQueue: [],
      sessionComplete: false,
    }
    mockAnswerStream.mockResolvedValue(new Response(
      makeSSEStream([
        { type: 'token', text: '토큰' },
        { type: 'done', ...donePayload },
      ]),
      { headers: { 'Content-Type': 'text/event-stream' } }
    ))

    const request = new Request('http://localhost/api/interview/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-1', currentAnswer: '답변입니다.' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')

    const text = await response.text()
    expect(text).toContain('"type":"token"')
    expect(text).toContain('"type":"done"')

    // drain: saveEngineResult 호출 확인
    expect(mockSaveEngineResult).toHaveBeenCalledWith('session-1', expect.objectContaining({
      sessionComplete: false,
    }))

    // drain: updateAfterAnswer 호출 확인
    expect(mockUpdateAfterAnswer).toHaveBeenCalledWith('session-1', expect.objectContaining({
      engineResultCache: null,
      sessionComplete: false,
    }))
  })

  it('engineResultCache 존재 시 done 이벤트만 반환한다', async () => {
    const cachedResult = {
      nextQuestion: { question: '캐시 질문', persona: 'hr', personaLabel: 'HR 담당자', type: 'main' },
      updatedQueue: [],
      sessionComplete: false,
    }
    mockFindById.mockResolvedValue({
      ...mockSession,
      engineResultCache: cachedResult,
    })
    mockAnswerStream.mockResolvedValue(new Response(
      makeSSEStream([{ type: 'done', ...cachedResult }]),
      { headers: { 'Content-Type': 'text/event-stream' } }
    ))

    const request = new Request('http://localhost/api/interview/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-1', currentAnswer: '답변입니다.' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain('"type":"done"')
    expect(text).not.toContain('"type":"token"')
  })

  it('인증 없이 401을 반환한다', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')
    vi.mocked(createServerClient).mockReturnValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as ReturnType<typeof createServerClient>)

    const request = new Request('http://localhost/api/interview/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-1', currentAnswer: '답변' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('다른 사용자 세션에 403을 반환한다', async () => {
    mockFindById.mockResolvedValue({ ...mockSession, userId: 'other-user' })

    const request = new Request('http://localhost/api/interview/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-1', currentAnswer: '답변' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it('공백만인 답변에 400을 반환한다', async () => {
    const request = new Request('http://localhost/api/interview/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-1', currentAnswer: '   ' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('token 이벤트 0개 스트림도 정상 처리된다 (done만)', async () => {
    const donePayload = {
      nextQuestion: null,
      updatedQueue: [],
      sessionComplete: true,
    }
    mockAnswerStream.mockResolvedValue(new Response(
      makeSSEStream([{ type: 'done', ...donePayload }]),
      { headers: { 'Content-Type': 'text/event-stream' } }
    ))

    const request = new Request('http://localhost/api/interview/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-1', currentAnswer: '마지막 답변' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain('"sessionComplete":true')
    expect(text).not.toContain('"type":"token"')
  })
})
