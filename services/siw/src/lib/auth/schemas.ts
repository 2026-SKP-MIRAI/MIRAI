import { z } from "zod"

export const passwordSchema = z
  .string()
  .min(8, "8자 이상 입력해주세요")
  .regex(/(?=.*[a-zA-Z])(?=.*[0-9])/, "영문과 숫자를 포함해야 합니다")

export const loginSchema = z.object({
  email: z.string().email("유효한 이메일을 입력해주세요"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
})

const consentFields = {
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: "이용약관에 동의해주세요",
  }),
  agreeToPrivacy: z.boolean().refine((val) => val === true, {
    message: "개인정보처리방침에 동의해주세요",
  }),
}

export const consentSchema = z.object(consentFields)

export const signupSchema = z
  .object({
    name: z.string().min(1, "이름을 입력해주세요").max(50, "이름은 50자 이하로 입력해주세요"),
    email: z.string().email("유효한 이메일을 입력해주세요"),
    password: passwordSchema,
    confirmPassword: z.string(),
    ...consentFields,
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"],
  })
