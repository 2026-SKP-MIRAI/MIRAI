import { z } from 'zod'

export const signupSchema = z
  .object({
    name: z.string().min(2, '이름은 2자 이상이어야 합니다').max(50, '이름은 50자 이하여야 합니다').trim(),
    email: z.string().email('올바른 이메일 형식이 아닙니다'),
    password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
    confirmPassword: z.string(),
    termsAgreed: z.boolean().refine((v) => v === true, { message: '이용약관에 동의해 주세요' }),
    privacyAgreed: z.boolean().refine((v) => v === true, { message: '개인정보처리방침에 동의해 주세요' }),
  })
  .superRefine(({ password, confirmPassword }, ctx) => {
    if (password !== confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '비밀번호가 일치하지 않습니다',
        path: ['confirmPassword'],
      })
    }
  })

export type SignupFormValues = z.infer<typeof signupSchema>
