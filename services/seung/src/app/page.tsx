import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-white">

      {/* 헤더 */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-extrabold text-[#1a1a2e] tracking-tight">MirAI</span>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
              로그인
            </Link>
            <Link href="/signup" className="rounded-lg bg-[#4361ee] px-4 py-2 text-sm font-bold text-white hover:bg-[#3a56d4] transition-colors">
              회원가입
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — 2단 레이아웃 */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* 왼쪽: 카피 */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#4361ee] mb-6 uppercase tracking-widest">
              AI 면접 코칭
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-[#1a1a2e] leading-[1.15] mb-5 tracking-tight">
              면접관이 뭘<br />
              물어볼지,<br />
              <span className="text-[#4361ee]">미리 알아보세요</span>
            </h1>
            <p className="text-base text-gray-500 leading-relaxed mb-8 max-w-md">
              내 자소서를 읽은 AI 면접관 3인이 실전 질문을 던집니다.
              막연한 면접 불안, 이제 데이터로 해결하세요.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <Link
                href="/signup"
                className="rounded-xl bg-[#4361ee] px-7 py-3.5 text-sm font-bold text-white text-center hover:bg-[#3a56d4] transition-all shadow-lg shadow-[#4361ee]/25"
              >
                지금 시작하기 →
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-gray-200 px-7 py-3.5 text-sm font-semibold text-gray-600 text-center hover:bg-gray-50 transition-colors"
              >
                로그인
              </Link>
            </div>
            <div className="flex items-center gap-6">
              {[
                { num: '3인', label: 'AI 면접관' },
                { num: '8개', label: '역량 축 분석' },
                { num: '2가지', label: '면접 모드' },
              ].map(({ num, label }) => (
                <div key={num}>
                  <p className="text-xl font-extrabold text-[#1a1a2e]">{num}</p>
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 오른쪽: 채팅 미리보기 mock */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-xl shadow-gray-200/60">
            {/* 타이틀바 */}
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-200">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-yellow-400" />
                <span className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <span className="text-xs text-gray-400 ml-2 font-medium">MirAI — 패널 면접</span>
            </div>

            {/* 채팅 메시지 */}
            <div className="space-y-4">
              {/* HR 질문 */}
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">HR 면접관</span>
                </div>
                <p className="text-sm text-gray-800 leading-relaxed">
                  자소서에서 언급하신 팀 프로젝트에서 가장 어려웠던 점은 무엇이었나요?
                </p>
              </div>

              {/* 사용자 답변 */}
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-xl bg-[#1a1a2e] px-4 py-3">
                  <p className="text-sm text-white leading-relaxed">
                    팀원 간 의견 충돌이 있었는데, 주 1회 회의를 통해 합의점을 찾았습니다.
                  </p>
                </div>
              </div>

              {/* 기술 리드 꼬리질문 */}
              <div className="rounded-xl border border-green-100 bg-green-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">기술 리드</span>
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">꼬리질문</span>
                </div>
                <p className="text-sm text-gray-800 leading-relaxed">
                  구체적으로 어떤 기술적 이슈가 있었는지 설명해주실 수 있나요?
                </p>
              </div>

              {/* 입력창 */}
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-sm text-gray-400 flex-1">답변을 입력하세요...</p>
                <button className="rounded-lg bg-[#4361ee] px-3 py-1.5 text-xs font-bold text-white">
                  답변 제출
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 이용 방법 */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h2 className="text-2xl font-extrabold text-[#1a1a2e] mb-2">3단계로 끝나는 면접 준비</h2>
          <p className="text-sm text-gray-400 mb-12">복잡한 설정 없이 바로 시작하세요</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { step: '01', title: '자소서 업로드', desc: 'PDF로 자소서를 올리면 AI가 내용을 분석합니다.' },
              { step: '02', title: 'AI 패널 면접', desc: 'HR·기술·임원 면접관이 맞춤 질문을 던집니다.' },
              { step: '03', title: '역량 리포트', desc: '8개 역량 축 분석과 개선 피드백을 확인하세요.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="text-left">
                <p className="text-4xl font-extrabold text-[#4361ee]/20 mb-3">{step}</p>
                <h3 className="text-base font-bold text-[#1a1a2e] mb-1.5">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 하단 CTA */}
      <section className="border-t border-gray-200">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1a1a2e] mb-3 tracking-tight">
            면접 불안을 자신감으로 바꾸세요
          </h2>
          <p className="text-gray-400 text-sm mb-8">자소서를 업로드하고 AI 면접관을 만나보세요.</p>
          <Link
            href="/signup"
            className="inline-block rounded-xl bg-[#4361ee] px-10 py-3.5 text-base font-bold text-white hover:bg-[#3a56d4] transition-all shadow-lg shadow-[#4361ee]/25"
          >
            지금 시작하기 →
          </Link>
        </div>
      </section>

    </div>
  )
}
