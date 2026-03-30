import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockS3Send } = vi.hoisted(() => ({
  mockS3Send: vi.fn(),
}))

vi.mock('@aws-sdk/client-s3', () => ({
  // regular function 필수 — arrow function은 new 키워드와 호환 안 됨
  S3Client: function () { return { send: mockS3Send } },
  GetObjectCommand: vi.fn(),
  NoSuchKey: class NoSuchKey extends Error {
    constructor() { super('NoSuchKey'); this.name = 'NoSuchKey' }
  },
}))

import { GET } from '@/app/api/analytics/events/route'

function makeRequest(params?: { date?: string; key?: string }): NextRequest {
  const url = params?.date
    ? `http://localhost/api/analytics/events?date=${params.date}`
    : 'http://localhost/api/analytics/events'
  return {
    url,
    headers: { get: (h: string) => (h === 'x-internal-key' ? (params?.key ?? 'test-key') : null) },
    nextUrl: new URL(url),
  } as unknown as NextRequest
}

const VALID_KEY = 'test-key'
const VALID_FUNNEL = {
  date: '2026-01-05',
  session_started: 10,
  report_generated: 3,
  start_to_report_rate: 0.3,
}

describe('GET /api/analytics/events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('ANALYTICS_API_KEY', VALID_KEY)
    vi.stubEnv('S3_EVENTS_BUCKET', 'test-bucket')
    vi.stubEnv('AWS_REGION', 'ap-northeast-2')

    mockS3Send.mockResolvedValue({
      Body: {
        transformToString: vi.fn().mockResolvedValue(JSON.stringify(VALID_FUNNEL)),
      },
    })
  })

  it('유효한 요청 → 200 + funnel JSON', async () => {
    const response = await GET(makeRequest({ date: '2026-01-05' }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.start_to_report_rate).toBe(0.3)
  })

  it('x-internal-key 없음 → 401', async () => {
    const response = await GET(makeRequest({ date: '2026-01-05', key: '' }))
    expect(response.status).toBe(401)
  })

  it('잘못된 x-internal-key → 401', async () => {
    const response = await GET(makeRequest({ date: '2026-01-05', key: 'wrong-key' }))
    expect(response.status).toBe(401)
  })

  it('ANALYTICS_API_KEY 미설정 → 503', async () => {
    vi.stubEnv('ANALYTICS_API_KEY', '')
    const response = await GET(makeRequest({ date: '2026-01-05' }))
    expect(response.status).toBe(503)
  })

  it('S3_EVENTS_BUCKET 미설정 → 503', async () => {
    vi.stubEnv('S3_EVENTS_BUCKET', '')
    const response = await GET(makeRequest({ date: '2026-01-05' }))
    expect(response.status).toBe(503)
  })

  it('잘못된 date 형식 → 400', async () => {
    const response = await GET(makeRequest({ date: '20260105' }))
    expect(response.status).toBe(400)
  })

  it('S3에 해당 날짜 데이터 없음 → 404', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { NoSuchKey: MockNoSuchKey } = await import('@aws-sdk/client-s3') as any
    mockS3Send.mockRejectedValueOnce(new MockNoSuchKey())
    const response = await GET(makeRequest({ date: '2026-01-05' }))
    expect(response.status).toBe(404)
  })
})
