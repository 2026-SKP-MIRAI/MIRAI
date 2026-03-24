"use client";

import { createClient } from "@/lib/supabase/browser";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const hasError = searchParams.get("error") === "oauth" || searchParams.get("error") === "invalid_link";

  const [tab, setTab] = useState<"social" | "email">("social");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  // createClient()와 redirectTo는 핸들러 내부에서만 계산 (SSR 프리렌더링 시 window 미정의)
  const oauthRedirectTo = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;

  const handleKakao = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: oauthRedirectTo() },
    });
  };

  const handleGoogle = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: oauthRedirectTo() },
    });
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setMessage(error.message === "Invalid login credentials" ? "이메일 또는 비밀번호가 올바르지 않습니다." : error.message);
          return;
        }
        router.push(safeNext);
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(safeNext)}`,
          },
        });
        if (error) {
          setMessage(error.message);
          return;
        }
        setMessage("확인 이메일을 발송했습니다. 받은편지함을 확인해주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100dvh-56px-64px)] bg-gray-50 px-5 py-8">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-2xl font-bold text-gray-900">로그인 / 가입</h1>
        <p className="text-sm text-gray-500">면접 결과를 영구 저장하고 히스토리를 확인하세요</p>
      </div>

      {hasError && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm">
          로그인 중 오류가 발생했습니다. 다시 시도해주세요.
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setTab("social")}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === "social" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
          }`}
        >
          소셜 로그인
        </button>
        <button
          onClick={() => setTab("email")}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === "email" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
          }`}
        >
          이메일
        </button>
      </div>

      {tab === "social" ? (
        <div className="flex flex-col gap-3">
          <button
            onClick={handleKakao}
            disabled={loading}
            className="w-full h-12 rounded-xl font-semibold text-gray-900 flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ backgroundColor: "#FEE500" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3C6.477 3 2 6.582 2 11c0 2.82 1.674 5.3 4.197 6.865L5.09 21.34a.375.375 0 0 0 .54.413l4.117-2.72C10.243 19.01 11.11 19.1 12 19.1c5.523 0 10-3.582 10-8.05S17.523 3 12 3z"/>
            </svg>
            카카오로 계속하기
          </button>
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full h-12 rounded-xl font-semibold text-gray-700 bg-white border border-gray-200 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            구글로 계속하기
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* 로그인/가입 토글 */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => { setMode("signin"); setMessage(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === "signin" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              로그인
            </button>
            <button
              onClick={() => { setMode("signup"); setMessage(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === "signup" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              가입하기
            </button>
          </div>

          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="이메일"
              required
              className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호 (8자 이상)"
              required
              minLength={8}
              className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            />

            {message && (
              <p className={`text-sm px-1 ${message.includes("발송") ? "text-[#0D9488]" : "text-red-500"}`}>
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#0D9488" }}
            >
              {loading ? "처리 중..." : mode === "signin" ? "로그인" : "가입하기"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
