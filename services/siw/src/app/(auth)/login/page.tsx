"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react"
import { createSupabaseBrowser } from "@/lib/supabase/browser"
import { loginSchema } from "@/lib/auth/schemas"

const AUTH_ERROR = "이메일 또는 비밀번호가 올바르지 않습니다"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard"
  const oauthError = searchParams.get("error") === "oauth"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(oauthError ? "Google 로그인 중 오류가 발생했습니다" : "")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const result = loginSchema.safeParse({ email, password })
    if (!result.success) { setError(result.error.issues[0].message); return }
    setLoading(true)
    try {
      const supabase = createSupabaseBrowser()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) { setError(AUTH_ERROR); return }
      const safe = redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/dashboard"
      router.push(safe)
      router.refresh()
    } finally { setLoading(false) }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    const supabase = createSupabaseBrowser()
    const safe = redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/dashboard"
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${safe}` },
    })
    setGoogleLoading(false)
  }

  return (
    <div
      className="w-full max-w-md"
      style={{ animation: "slideUpFadeIn 0.7s cubic-bezier(0.16,1,0.3,1) both" }}
    >
      <style>{`
        @keyframes slideUpFadeIn {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="bg-white rounded-2xl p-8 border border-black/[0.06] shadow-sm">
        {/* 로고 */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}>
              <svg className="w-[18px] h-[18px] text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
              </svg>
            </div>
            <span className="text-lg font-extrabold text-gray-800">MirAI</span>
          </Link>
          <h1 className="text-2xl font-extrabold text-gray-900">다시 오신 걸 환영합니다</h1>
          <p className="text-sm text-gray-400 mt-1">면접 연습을 이어서 진행하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">이메일</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com" required
                className="w-full bg-[#F9FAFB] border border-black/[0.12] rounded-xl pl-10 pr-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">비밀번호</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요" required
                className="w-full bg-[#F9FAFB] border border-black/[0.12] rounded-xl pl-10 pr-11 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10 focus:bg-white transition-all"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 에러 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
              <span>⚠</span><span>{error}</span>
            </div>
          )}

          {/* 로그인 버튼 */}
          <button
            type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            style={{
              background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
              boxShadow: "0 4px 14px rgba(79,70,229,0.3)",
            }}
          >
            {loading ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            ) : (
              <>로그인 <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>

        {/* OR 구분선 */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-black/[0.08]" />
          <span className="text-xs text-gray-400">또는</span>
          <div className="flex-1 h-px bg-black/[0.08]" />
        </div>

        {/* Google */}
        <button
          onClick={handleGoogle} disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 border border-black/[0.15] rounded-xl px-4 py-3 text-sm font-medium text-gray-600 hover:border-violet-400/50 hover:bg-violet-500/[0.06] hover:text-violet-700 transition-all duration-200 disabled:opacity-60"
        >
          {googleLoading ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          Google로 계속하기
        </button>

        <p className="text-center text-sm text-gray-400 mt-5">
          계정이 없으신가요?{" "}
          <Link href="/signup" className="text-violet-600 font-semibold hover:text-violet-700">회원가입</Link>
        </p>
      </div>
    </div>
  )
}
