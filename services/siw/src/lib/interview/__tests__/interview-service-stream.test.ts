import { describe, it, expect, vi, beforeEach } from 'vitest'

// fetch mock
const mockFetch = vi.fn()
global.fetch = mockFetch

// interviewRepository mock
vi.mock('@/lib/interview/interview-repository', () => ({
  interviewRepository: {
    findById: vi.fn(),
    saveEngineResult: vi.fn().mockResolvedValue(undefined),
    updateAfterAnswer: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
  },
}))

// resumeRepository mock
vi.mock('@/lib/resume-repository', () => ({
  resumeRepository: {
    findById: vi.fn(),
  },
}))

// observability mock
vi.mock('@/lib/observability/event-logger', () => ({
  withEventLogging: vi.fn((event, sessionId, fn) => fn({ retry_count: 0 })),
}))

import { interviewRepository } from '@/lib/interview/interview-repository'
import { interviewService } from '../interview-service'

const mockFindById = vi.mocked(interviewRepository.findById)

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

describe('interviewService.answerStream', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFindById.mockReset()
    mockFindById.mockResolvedValue(mockSession)
  })

  it('SSE 연결 성공 시 Response를 반환한다', async () => {
    mockFetch.mockResolvedValue(new Response(
      makeSSEStream([
        { type: 'done', nextQuestion: null, updatedQueue: [], sessionComplete: true },
      ]),
      { status: 200 }
    ))

    const result = await interviewService.answerStream('session-1', '답변')
    expect(result).toBeInstanceOf(Response)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('?stream=true 쿼리 파라미터로 엔진을 호출한다', async () => {
    mockFetch.mockResolvedValue(new Response(makeSSEStream([]), { status: 200 }))

    await interviewService.answerStream('session-1', '답변')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('?stream=true'),
      expect.any(Object),
    )
  })

  it('연결 실패 시 3회 재시도한다', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('네트워크 오류'))
      .mockRejectedValueOnce(new Error('네트워크 오류'))
      .mockResolvedValue(new Response(makeSSEStream([]), { status: 200 }))

    const result = await interviewService.answerStream('session-1', '답변')
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(result).toBeInstanceOf(Response)
  })

  it('3회 모두 실패 시 에러를 던진다', async () => {
    mockFetch.mockRejectedValue(new Error('네트워크 오류'))

    await expect(interviewService.answerStream('session-1', '답변')).rejects.toThrow()
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('HTTP 비정상 응답 시 재시도한다', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValue(new Response(makeSSEStream([]), { status: 200 }))

    await interviewService.answerStream('session-1', '답변')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('engineResultCache 존재 시 캐시 데이터를 done 이벤트로 반환한다', async () => {
    const cachedResult = {
      nextQuestion: { question: '캐시 질문', persona: 'hr', personaLabel: 'HR 담당자', type: 'main' },
      updatedQueue: [],
      sessionComplete: false,
    }
    mockFindById.mockResolvedValue({ ...mockSession, engineResultCache: cachedResult })

    const result = await interviewService.answerStream('session-1', '답변')

    // fetch가 호출되지 않아야 함 (캐시 사용)
    expect(mockFetch).not.toHaveBeenCalled()

    // 반환된 스트림에서 done 이벤트만 있어야 함
    const text = await result.text()
    expect(text).toContain('"type":"done"')
    expect(text).not.toContain('"type":"token"')
  })

  it('session_complete 세션에 에러를 던진다', async () => {
    mockFindById.mockResolvedValue({ ...mockSession, sessionComplete: true })

    await expect(interviewService.answerStream('session-1', '답변')).rejects.toThrow('session_complete')
  })
})
