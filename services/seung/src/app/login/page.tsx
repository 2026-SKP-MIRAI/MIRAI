'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(
    searchParams.get('error') === 'invalid_code' ? '인증 링크가 만료되었거나 이미 사용된 링크입니다. 다시 로그인해 주세요.' : ''
  )
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
      return
    }

    // 오픈 리다이렉트 차단: pathname만 허용
    const redirectTo = searchParams.get('redirectTo') ?? ''
    const safePath = redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/dashboard'
    router.push(safePath)
    router.refresh()
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4361ee] focus:border-[#4361ee] disabled:opacity-50 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4361ee] focus:border-[#4361ee] disabled:opacity-50 transition-colors"
            />
          </div>
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5" role="alert">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#4361ee] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3a56d4] disabled:opacity-50 transition-colors mt-1"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="font-semibold text-[#4361ee] hover:underline">회원가입</Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm sm:max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-md">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1a1a2e] mb-3">
              <span className="text-white text-xl font-bold">M</span>
            </div>
          </div>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
