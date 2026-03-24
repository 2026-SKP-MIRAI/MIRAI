import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { rateLimit } from '@/lib/rate-limit'

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('한도 이하 요청은 허용한다', () => {
    const key = 'user-1:test-endpoint'
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 60_000)).toBe(true)
    }
  })

  it('한도 초과 요청은 차단하고 남은 초를 반환한다', () => {
    const key = 'user-2:test-endpoint'
    for (let i = 0; i < 5; i++) {
      rateLimit(key, 5, 60_000)
    }
    const result = rateLimit(key, 5, 60_000)
    expect(result).not.toBe(true)
    expect(typeof result).toBe('number')
    expect(result as number).toBeGreaterThan(0)
  })

  it('창(window) 만료 후 카운트가 초기화된다', () => {
    const key = 'user-3:test-endpoint'
    for (let i = 0; i < 5; i++) {
      rateLimit(key, 5, 60_000)
    }
    expect(rateLimit(key, 5, 60_000)).not.toBe(true)

    vi.advanceTimersByTime(60_001)

    expect(rateLimit(key, 5, 60_000)).toBe(true)
  })

  it('다른 키는 서로 영향을 주지 않는다', () => {
    const keyA = 'user-4:endpoint-a'
    const keyB = 'user-4:endpoint-b'

    for (let i = 0; i < 5; i++) {
      rateLimit(keyA, 5, 60_000)
    }
    // keyA 초과되어도 keyB는 허용
    expect(rateLimit(keyA, 5, 60_000)).not.toBe(true)
    expect(rateLimit(keyB, 5, 60_000)).toBe(true)
  })

  it('limit=1이면 두 번째 요청부터 차단한다', () => {
    const key = 'user-5:strict'
    expect(rateLimit(key, 1, 60_000)).toBe(true)
    expect(rateLimit(key, 1, 60_000)).not.toBe(true)
  })
})
