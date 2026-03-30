import { describe, it, expect } from 'vitest'
import { signupSchema } from '@/lib/schemas/auth'

const VALID_INPUT = {
  name: '홍길동',
  email: 'test@example.com',
  password: 'password123',
  confirmPassword: 'password123',
  termsAgreed: true,
  privacyAgreed: true,
}

describe('signupSchema', () => {
  it('정상 입력 → parse 성공', () => {
    const result = signupSchema.safeParse(VALID_INPUT)
    expect(result.success).toBe(true)
  })

  it('name 1자 → 에러', () => {
    const result = signupSchema.safeParse({ ...VALID_INPUT, name: '홍' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain('이름은 2자 이상이어야 합니다')
    }
  })

  it('name 51자 → 에러', () => {
    const result = signupSchema.safeParse({ ...VALID_INPUT, name: '가'.repeat(51) })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain('이름은 50자 이하여야 합니다')
    }
  })

  it('name 앞뒤 공백 → trim 후 parse 성공', () => {
    const result = signupSchema.safeParse({ ...VALID_INPUT, name: '  홍길동  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('홍길동')
    }
  })

  it('email 형식 오류 → 에러', () => {
    const result = signupSchema.safeParse({ ...VALID_INPUT, email: 'not-an-email' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain('올바른 이메일 형식이 아닙니다')
    }
  })

  it('password 7자 → 에러', () => {
    const result = signupSchema.safeParse({ ...VALID_INPUT, password: '1234567', confirmPassword: '1234567' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain('비밀번호는 8자 이상이어야 합니다')
    }
  })

  it('confirmPassword 불일치 → 에러', () => {
    const result = signupSchema.safeParse({ ...VALID_INPUT, confirmPassword: 'different' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain('비밀번호가 일치하지 않습니다')
    }
  })

  it('termsAgreed false → 에러', () => {
    const result = signupSchema.safeParse({ ...VALID_INPUT, termsAgreed: false })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain('이용약관에 동의해 주세요')
    }
  })

  it('privacyAgreed false → 에러', () => {
    const result = signupSchema.safeParse({ ...VALID_INPUT, privacyAgreed: false })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain('개인정보처리방침에 동의해 주세요')
    }
  })
})
