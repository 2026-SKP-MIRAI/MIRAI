import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockS3Send } = vi.hoisted(() => ({
  mockS3Send: vi.fn(),
}))

vi.mock('@aws-sdk/client-s3', () => ({
  // regular function 필수 — arrow function은 new 키워드와 호환 안 됨
  S3Client: function () { return { send: mockS3Send } },
  PutObjectCommand: vi.fn(),
}))

import { logEvent } from '@/lib/event-logger'

const BASE_EVENT = {
  event_type: 'session_started' as const,
  user_id: 'user-1',
  session_id: 'session-1',
  timestamp: '2026-03-30T00:00:00.000Z',
  properties: { resume_id: 'resume-1' },
}

describe('logEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('S3_EVENTS_BUCKET', 'test-bucket')
    vi.stubEnv('AWS_REGION', 'ap-northeast-2')
    mockS3Send.mockResolvedValue({})
  })

  it('S3_EVENTS_BUCKET 미설정 시 S3 호출 없이 반환', async () => {
    vi.stubEnv('S3_EVENTS_BUCKET', '')
    await logEvent(BASE_EVENT)
    expect(mockS3Send).not.toHaveBeenCalled()
  })

  it('정상 이벤트 → S3 PutObjectCommand 1회 호출', async () => {
    await logEvent(BASE_EVENT)
    expect(mockS3Send).toHaveBeenCalledTimes(1)
  })

  it('S3 key가 events/YYYY/MM/DD/ 형식으로 시작', async () => {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    await logEvent(BASE_EVENT)
    const callArg = vi.mocked(PutObjectCommand).mock.calls[0][0]
    expect(callArg.Key).toMatch(/^events\/\d{4}\/\d{2}\/\d{2}\//)
  })

  it('S3 에러 시 throw — 호출부에서 .catch()로 처리해야 함', async () => {
    mockS3Send.mockRejectedValueOnce(new Error('S3 error'))
    await expect(logEvent(BASE_EVENT)).rejects.toThrow('S3 error')
  })

  it('이벤트 body에 event_type, user_id, session_id 포함', async () => {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    await logEvent(BASE_EVENT)
    const callArg = vi.mocked(PutObjectCommand).mock.calls[0][0]
    const body = JSON.parse(callArg.Body as string)
    expect(body.event_type).toBe('session_started')
    expect(body.user_id).toBe('user-1')
    expect(body.session_id).toBe('session-1')
  })
})
