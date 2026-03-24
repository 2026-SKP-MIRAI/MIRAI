const store = new Map<string, { count: number; resetAt: number }>()

/**
 * In-memory rate limiter.
 * @returns true if the request is allowed, false if the limit is exceeded.
 *
 * NOTE: This implementation is single-process only.
 * Replace with Upstash Redis before public release (keep the same signature).
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const record = store.get(key)
  if (!record || now > record.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (record.count >= limit) return false
  record.count++
  return true
}

/** 테스트 전용: store 초기화. 프로덕션 코드에서 호출 금지. */
export function _clearStoreForTesting() {
  store.clear()
}
