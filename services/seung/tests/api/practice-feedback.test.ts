import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockFetch = vi.fn()
global.fetch = mockFetch

import { POST } from '@/app/api/practice/feedback/route'

function makeRequest(body: Record<string, unknown>): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest
}

describe('POST /api/practice/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENGINE_BASE_URL = 'http://localhost:8000'
  })

  it('성공 (첫 답변): score, feedback, keywords, improvedAnswerGuide, comparisonDelta: null 반환', async () => {
    const engineData = {
      score: 80,
      feedback: { good: ['명확한 설명'], improve: ['구체적 예시 추가'] },
      keywords: ['성과', '협업'],
      improvedAnswerGuide: '더 구체적인 수치를 활용하세요.',
      comparisonDelta: null,
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => engineData,
    })

    const response = await POST(makeRequest({ question: '자기소개를 해주세요.', answer: '저는...' }))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.score).toBe(80)
    expect(body.feedback).toEqual({ good: ['명확한 설명'], improve: ['구체적 예시 추가'] })
    expect(body.keywords).toEqual(['성과', '협업'])
    expect(body.improvedAnswerGuide).toBe('더 구체적인 수치를 활용하세요.')
    expect(body.comparisonDelta).toBeNull()
  })

  it('성공 (재답변): comparisonDelta 포함 반환', async () => {
    const engineData = {
      score: 88,
      feedback: { good: ['개선된 설명'], improve: [] },
      keywords: ['성과'],
      improvedAnswerGuide: '좋습니다.',
      comparisonDelta: { scoreDelta: 8, improvements: ['구체적 수치 추가됨'] },
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => engineData,
    })

    const response = await POST(
      makeRequest({ question: '자기소개를 해주세요.', answer: '개선된 답변...', previousAnswer: '이전 답변...' }),
    )
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.comparisonDelta).toEqual({ scoreDelta: 8, improvements: ['구체적 수치 추가됨'] })
  })

  it('question 누락 시 400 반환', async () => {
    const response = await POST(makeRequest({ answer: '저는...' }))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('question')
  })

  it('answer 누락 시 400 반환', async () => {
    const response = await POST(makeRequest({ question: '자기소개를 해주세요.' }))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('answer')
  })

  it('answer 빈 문자열 시 400 반환', async () => {
    const response = await POST(makeRequest({ question: '자기소개를 해주세요.', answer: '' }))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBeDefined()
  })

  it('ENGINE_BASE_URL 미설정 시 500 반환', async () => {
    delete process.env.ENGINE_BASE_URL

    const response = await POST(makeRequest({ question: '자기소개를 해주세요.', answer: '저는...' }))
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toContain('서버 설정')
  })

  it('엔진 400 → 서비스 400 (에러 그대로 전달)', async () => {
    const engineError = { detail: 'answer 필드가 비어 있습니다.' }
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => engineError,
    })

    const response = await POST(makeRequest({ question: '자기소개를 해주세요.', answer: '저는...' }))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.detail).toBe('answer 필드가 비어 있습니다.')
  })

  it('엔진 500 → 서비스 500', async () => {
    const engineError = { detail: 'LLM 오류' }
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => engineError,
    })

    const response = await POST(makeRequest({ question: '자기소개를 해주세요.', answer: '저는...' }))
    expect(response.status).toBe(500)
  })

  it('question이 문자열이 아닌 타입(숫자)이면 400 반환', async () => {
    const response = await POST(makeRequest({ question: 123, answer: '저는...' }))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('question')
  })

  it('answer가 문자열이 아닌 타입(숫자)이면 400 반환', async () => {
    const response = await POST(makeRequest({ question: '자기소개를 해주세요.', answer: 456 }))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('answer')
  })

  it('엔진이 non-JSON 응답(400) 반환 시 400 상태코드 보존', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => { throw new SyntaxError('Unexpected token') },
    })

    const response = await POST(makeRequest({ question: '자기소개를 해주세요.', answer: '저는...' }))
    expect(response.status).toBe(400)
  })

  it('엔진이 non-JSON 응답(503) 반환 시 503 상태코드 보존', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => { throw new SyntaxError('Unexpected token') },
    })

    const response = await POST(makeRequest({ question: '자기소개를 해주세요.', answer: '저는...' }))
    expect(response.status).toBe(503)
  })
})
