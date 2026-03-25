"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createSupabaseBrowser } from "@/lib/supabase/browser"
import { consentSchema } from "@/lib/auth/schemas"

export default function ConsentPage() {
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [agreeToPrivacy, setAgreeToPrivacy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createSupabaseBrowser()

  const handleConsent = async () => {
    const result = consentSchema.safeParse({ agreeToTerms, agreeToPrivacy })
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors
      setErrors({
        agreeToTerms: fieldErrors.agreeToTerms?.[0] ?? "",
        agreeToPrivacy: fieldErrors.agreeToPrivacy?.[0] ?? "",
      })
      return
    }
    setLoading(true)
    await supabase.auth.updateUser({ data: { terms_agreed_at: new Date().toISOString() } })
    router.push("/dashboard")
  }

  const handleReject = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await fetch("/api/auth/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      })
    }
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6 p-6">
      <h1 className="text-2xl font-bold">서비스 이용을 위한 약관 동의</h1>
      <p className="text-sm text-muted-foreground">서비스를 이용하시려면 아래 약관에 동의해 주세요.</p>

      <div className="space-y-3">
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={agreeToTerms}
            onChange={(e) => setAgreeToTerms(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <a href="/terms" target="_blank" className="underline text-primary">[이용약관]</a>에 동의합니다 <span className="text-destructive">*필수</span>
          </span>
        </label>
        {errors.agreeToTerms && <p className="text-xs text-red-500 ml-6">{errors.agreeToTerms}</p>}

        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={agreeToPrivacy}
            onChange={(e) => setAgreeToPrivacy(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <a href="/privacy" target="_blank" className="underline text-primary">[개인정보처리방침]</a>에 동의합니다 (국외이전 포함) <span className="text-destructive">*필수</span>
          </span>
        </label>
        {errors.agreeToPrivacy && <p className="text-xs text-red-500 ml-6">{errors.agreeToPrivacy}</p>}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleReject}
          disabled={loading}
          className="flex-1 rounded-xl py-3 text-sm font-medium text-gray-600 bg-white border border-black/[0.12] hover:bg-gray-50 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          거부하고 탈퇴
        </button>
        <button
          type="button"
          onClick={handleConsent}
          disabled={loading}
          className="flex-1 rounded-xl py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)", boxShadow: "0 4px 14px rgba(79,70,229,0.3)" }}
        >
          동의하고 시작하기
        </button>
      </div>
    </div>
  )
}
