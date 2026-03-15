"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { User, Mail, Lock, ArrowRight } from "lucide-react"
import { createSupabaseBrowser } from "@/lib/supabase/browser"
import { signupSchema } from "@/lib/auth/schemas"

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleGoogleSignup = async () => {
    const supabase = createSupabaseBrowser()
    const origin = window.location.origin
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/callback` },
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const result = signupSchema.safeParse({ name, email, password, confirmPassword })
    if (!result.success) { setError(result.error.issues[0].message); return }
    setLoading(true)
    try {
      const supabase = createSupabaseBrowser()
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      })
      if (authError) { setError("회원가입 중 오류가 발생했습니다. 다시 시도해주세요."); return }
      setSuccess(true)
    } finally { setLoading(false) }
  }

  const inputClass = "w-full bg-[#F9FAFB] border border-black/[0.12] rounded-xl pl-10 pr-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10 focus:bg-white transition-all"

  if (success) {
    return (
      <div className="w-full max-w-md bg-white rounded-2xl p-8 border border-black/[0.06] shadow-sm text-center"
        style={{ animation: "slideUpFadeIn 0.8s cubic-bezier(0.16,1,0.3,1) both" }}>
        <style>{`@keyframes slideUpFadeIn { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }`}</style>
        <div className="text-4xl mb-4">📧</div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">이메일을 확인해주세요</h2>
        <p className="text-sm text-gray-500 mb-6">입력하신 이메일로 인증 링크를 전송했습니다.<br/>링크를 클릭해 가입을 완료하세요.</p>
        <Link href="/login"
          className="inline-block rounded-xl px-6 py-2.5 text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}>
          로그인으로 이동
        </Link>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes slideUpFadeIn { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideRightFadeIn { from { opacity:0; transform:translateX(-30px); } to { opacity:1; transform:translateX(0); } }
      `}</style>

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* 왼쪽: Benefits (모바일 hidden) */}
        <div className="hidden lg:block" style={{ animation: "slideRightFadeIn 0.8s cubic-bezier(0.16,1,0.3,1) both" }}>
          <div className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full mb-5"
            style={{ background: "rgba(124,58,237,0.1)", color: "#6D28D9", border: "1px solid rgba(124,58,237,0.2)" }}>
            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
            </svg>
            무료로 시작
          </div>
          <h2 className="text-4xl font-extrabold text-gray-900 leading-snug mb-3">
            당신의 첫 번째 면접관<br/>
            <span style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              MirAI와 함께 하세요
            </span>
          </h2>
          <p className="text-[15px] text-gray-500 leading-relaxed mb-8">
            강점도, 약점도 데이터로 직면하세요.<br/>MirAI와 함께라면 다음 면접은 다릅니다.
          </p>
          <ul className="space-y-4">
            {[
              "AI 이력서 분석",
              "3가지 페르소나 면접",
              "8축 정밀 피드백",
              "성장 추이 대시보드",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-[15px] text-gray-600">
                <svg className="w-[18px] h-[18px] text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* 오른쪽: 폼 카드 */}
        <div className="bg-white rounded-2xl p-8 border border-black/[0.06] shadow-sm w-full"
          style={{ animation: "slideUpFadeIn 0.7s cubic-bezier(0.16,1,0.3,1) 0.15s both" }}>

          {/* 모바일용 로고 */}
          <div className="lg:hidden text-center mb-6">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-9 h-9 rounded-[10px] flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}>
                <svg className="w-[18px] h-[18px] text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                </svg>
              </div>
              <span className="text-lg font-extrabold text-gray-800">MirAI</span>
            </Link>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-6">계정 만들기</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">이름</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="홍길동" required className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">이메일</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com" required className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="8자 이상" required className={inputClass} />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">ⓘ 8자 이상, 영문 + 숫자 포함</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">비밀번호 확인</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호 재입력" required className={inputClass} />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
                <span>⚠</span><span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)", boxShadow: "0 4px 14px rgba(79,70,229,0.3)" }}>
              {loading ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              ) : (
                <>가입하고 시작하기 <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 mt-5">
            <div className="flex-1 h-px bg-black/[0.08]" />
            <span className="text-xs text-gray-400">또는</span>
            <div className="flex-1 h-px bg-black/[0.08]" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignup}
            className="mt-3 w-full flex items-center justify-center gap-2.5 rounded-xl py-3 text-sm font-medium text-gray-700 bg-white border border-black/[0.12] hover:bg-gray-50 transition-all duration-200"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google로 계속하기
          </button>

          <p className="text-center text-sm text-gray-400 mt-4">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="text-violet-600 font-semibold hover:text-violet-700">로그인</Link>
          </p>
        </div>
      </div>
    </>
  )
}
