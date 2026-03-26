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

function makeSSEStream(events: object[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const e of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
      }
      controller.close()
    },
  })
}

// 마지막 이벤트에 \n\n 없이 종료되는 스트림 (버퍼 flush 테스트용)
function makeSSEStreamNoBoundary(events: object[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (let i = 0; i < events.length; i++) {
        const suffix = i < events.length - 1 ? '\n\n' : ''
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(events[i])}${suffix}`))
      }
      controller.close()
    },
  })
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

describe('POST /api/interview/answer (SSE 스트리밍)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENGINE_BASE_URL = 'http://localhost:8000'
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    })
  })

  it('SSE 스트림을 클라이언트에 패스스루하고 done 이벤트로 DB를 업데이트한다', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(mockSession)
    mockPrisma.resume.findUnique.mockResolvedValueOnce({ resumeText: '자소서' })
    mockPrisma.interviewSession.update.mockResolvedValueOnce({})

    const donePayload = {
      nextQuestion: { persona: 'tech_lead', personaLabel: '기술 리드', question: '기술 스택을 설명해주세요.', type: 'main' },
      updatedQueue: [],
      sessionComplete: false,
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: makeSSEStream([
        { type: 'token', text: '기술' },
        { type: 'token', text: ' 스택을' },
        { type: 'done', ...donePayload },
      ]),
    })

    const response = await POST(makeRequest({ sessionId: 'session-1', answer: '저는 개발자입니다.' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')

    const text = await response.text()
    expect(text).toContain('"type":"token"')
    expect(text).toContain('"type":"done"')

    // done 이벤트에서 DB 업데이트 확인
    expect(mockPrisma.interviewSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'session-1' }),
        data: expect.objectContaining({
          sessionComplete: false,
          currentQuestion: '기술 스택을 설명해주세요.',
        }),
      })
    )
  })

  it('token 없이 done만 있는 스트림도 정상 처리된다 (sessionComplete=true)', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(mockSession)
    mockPrisma.resume.findUnique.mockResolvedValueOnce({ resumeText: '자소서' })
    mockPrisma.interviewSession.update.mockResolvedValueOnce({})

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: makeSSEStream([
        { type: 'done', nextQuestion: null, updatedQueue: [], sessionComplete: true },
      ]),
    })

    const response = await POST(makeRequest({ sessionId: 'session-1', answer: '마지막 답변' }))
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain('"sessionComplete":true')
    expect(text).not.toContain('"type":"token"')

    expect(mockPrisma.interviewSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sessionComplete: true }),
      })
    )
  })

  it('엔진 URL에 ?stream=true가 포함된다', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(mockSession)
    mockPrisma.resume.findUnique.mockResolvedValueOnce({ resumeText: '자소서' })
    mockPrisma.interviewSession.update.mockResolvedValueOnce({})

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: makeSSEStream([{ type: 'done', nextQuestion: null, updatedQueue: [], sessionComplete: false }]),
    })

    await POST(makeRequest({ sessionId: 'session-1', answer: '답변' }))

    const [calledUrl] = mockFetch.mock.calls[0] as [string]
    expect(calledUrl).toContain('?stream=true')
  })

  it('5000자 초과 답변은 5000자로 잘라서 엔진에 전달', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(mockSession)
    mockPrisma.resume.findUnique.mockResolvedValueOnce({ resumeText: '자소서' })
    mockPrisma.interviewSession.update.mockResolvedValueOnce({})

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: makeSSEStream([{ type: 'done', nextQuestion: null, updatedQueue: [], sessionComplete: false }]),
    })

    const longAnswer = 'a'.repeat(5001)
    await POST(makeRequest({ sessionId: 'session-1', answer: longAnswer }))

    const [, options] = mockFetch.mock.calls[0] as [string, { body: string }]
    const requestBody = JSON.parse(options.body)
    expect(requestBody.currentAnswer.length).toBe(5000)
  })

  it('엔진 응답 ok=false → SSE 시작 전 502 반환', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(mockSession)
    mockPrisma.resume.findUnique.mockResolvedValueOnce({ resumeText: '자소서' })

    mockFetch.mockResolvedValueOnce({ ok: false, body: null })

    const response = await POST(makeRequest({ sessionId: 'session-1', answer: '답변' }))
    expect(response.status).toBe(502)
  })

  it('sessionId 누락 시 400 반환', async () => {
    const response = await POST(makeRequest({ answer: '답변' }))
    expect(response.status).toBe(400)
  })

  it('빈 답변(공백만) 시 400 반환 — DB 조회 없이 즉시 거절', async () => {
    const response = await POST(makeRequest({ sessionId: 'session-1', answer: '   \n  ' }))
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

  it('세션 없으면 404 반환', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(null)

    const response = await POST(makeRequest({ sessionId: 'nonexistent', answer: '답변' }))
    expect(response.status).toBe(404)
  })

  it('이미 완료된 세션에 답변 시 400 반환', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce({
      ...mockSession,
      sessionComplete: true,
    })

    const response = await POST(makeRequest({ sessionId: 'session-1', answer: '답변' }))
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

  it('엔진 타임아웃 시 504 반환', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(mockSession)
    mockPrisma.resume.findUnique.mockResolvedValueOnce({ resumeText: '자소서' })

    const timeoutError = new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    mockFetch.mockRejectedValueOnce(timeoutError)

    const response = await POST(makeRequest({ sessionId: 'session-1', answer: '답변' }))
    expect(response.status).toBe(504)
    const body = await response.json()
    expect(body.error).toContain('지연')
  })

  it('엔진 에러 시 500 + generic 메시지 반환 (내부 에러 미노출)', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(mockSession)
    mockPrisma.resume.findUnique.mockResolvedValueOnce({ resumeText: '자소서' })

    mockFetch.mockRejectedValueOnce(new Error('internal engine error'))

    const response = await POST(makeRequest({ sessionId: 'session-1', answer: '답변' }))
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('서버 오류가 발생했습니다.')
    expect(body.detail).toBeUndefined()
  })

  it('\\n\\n 없이 종료된 스트림에서도 200을 반환한다 (버퍼 flush — parseSSEStream 단위 테스트에서 검증)', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(mockSession)
    mockPrisma.resume.findUnique.mockResolvedValueOnce({ resumeText: '자소서' })
    mockPrisma.interviewSession.update.mockResolvedValueOnce({})

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: makeSSEStreamNoBoundary([
        { type: 'done', nextQuestion: null, updatedQueue: [], sessionComplete: true },
      ]),
    })

    const response = await POST(makeRequest({ sessionId: 'session-1', answer: '답변' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
  })
})
