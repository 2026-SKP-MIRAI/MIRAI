import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getEngineBaseUrl, isValidEmbeddingVector } from '../embedding-client'

describe('getEngineBaseUrl', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.stubEnv('ENGINE_BASE_URL', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('ENGINE_BASE_URL 설정 시 해당 값을 반환한다', () => {
    vi.stubEnv('ENGINE_BASE_URL', 'http://engine:8000')
    expect(getEngineBaseUrl()).toBe('http://engine:8000')
  })

  it('ENGINE_BASE_URL 미설정 시 null을 반환한다', () => {
    delete process.env.ENGINE_BASE_URL
    expect(getEngineBaseUrl()).toBeNull()
  })
})

describe('isValidEmbeddingVector', () => {
  it('유효한 float 배열이면 true', () => {
    expect(isValidEmbeddingVector([0.1, 0.2, -0.3, 0.0])).toBe(true)
  })

  it('빈 배열이면 false', () => {
    expect(isValidEmbeddingVector([])).toBe(false)
  })

  it('NaN 포함 시 false', () => {
    expect(isValidEmbeddingVector([0.1, NaN, 0.3])).toBe(false)
  })

  it('Infinity 포함 시 false', () => {
    expect(isValidEmbeddingVector([0.1, Infinity, 0.3])).toBe(false)
  })

  it('-Infinity 포함 시 false', () => {
    expect(isValidEmbeddingVector([0.1, -Infinity, 0.3])).toBe(false)
  })

  it('문자열 포함 시 false', () => {
    expect(isValidEmbeddingVector([0.1, 'abc' as unknown as number, 0.3])).toBe(false)
  })

  it('null 포함 시 false', () => {
    expect(isValidEmbeddingVector([0.1, null as unknown as number, 0.3])).toBe(false)
  })

  it('undefined 포함 시 false', () => {
    expect(isValidEmbeddingVector([0.1, undefined as unknown as number, 0.3])).toBe(false)
  })
})
