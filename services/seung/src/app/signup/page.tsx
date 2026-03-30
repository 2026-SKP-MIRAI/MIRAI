'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import { signupSchema } from '@/lib/schemas/auth'
import GoogleOAuthButton from '@/components/GoogleOAuthButton'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const canSubmit = termsAgreed && privacyAgreed && !loading

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const parsed = signupSchema.safeParse({ name, email, password, confirmPassword, termsAgreed, privacyAgreed })
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as string
        if (!fieldErrors[field]) fieldErrors[field] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (authError) {
      setErrors({ form: '회원가입에 실패했습니다. 다시 시도해 주세요.' })
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
  }


  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm sm:max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-md text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1a1a2e] mb-3">
            <span className="text-white text-xl font-bold">M</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1a1a2e] mb-3">이메일을 확인해 주세요</h1>
          <p className="text-sm text-gray-500">
            {email}으로 인증 링크를 보냈습니다. 메일함을 확인해 주세요.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm sm:max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-md">
        {/* 브랜드 헤더 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1a1a2e] mb-3">
            <span className="text-white text-xl font-bold">M</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">MirAI</h1>
          <p className="text-sm text-gray-500 mt-1">AI 면접 코치</p>
        </div>

        <GoogleOAuthButton onError={(msg) => setErrors({ form: msg })} />

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">또는</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="signup-name" className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input
              id="signup-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4361ee] focus:border-[#4361ee] disabled:opacity-50 transition-colors"
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4361ee] focus:border-[#4361ee] disabled:opacity-50 transition-colors"
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4361ee] focus:border-[#4361ee] disabled:opacity-50 transition-colors"
            />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
          </div>

          <div>
            <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인</label>
            <input
              id="signup-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4361ee] focus:border-[#4361ee] disabled:opacity-50 transition-colors"
            />
            {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
          </div>

          <div className="flex flex-col gap-2 mt-1">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
                disabled={loading}
                className="mt-0.5 accent-[#4361ee]"
              />
              <span className="text-sm text-gray-600">
                <Link href="/terms" target="_blank" className="text-[#4361ee] hover:underline">이용약관</Link>에 동의합니다 (필수)
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={privacyAgreed}
                onChange={(e) => setPrivacyAgreed(e.target.checked)}
                disabled={loading}
                className="mt-0.5 accent-[#4361ee]"
              />
              <span className="text-sm text-gray-600">
                <Link href="/privacy" target="_blank" className="text-[#4361ee] hover:underline">개인정보처리방침</Link>에 동의합니다 (필수)
              </span>
            </label>
          </div>

          {errors.form && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5" role="alert">
              <p className="text-sm text-red-700">{errors.form}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-[#4361ee] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3a56d4] disabled:opacity-50 transition-colors mt-1"
          >
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-semibold text-[#4361ee] hover:underline">로그인</Link>
        </p>
      </div>
    </div>
  )
}
