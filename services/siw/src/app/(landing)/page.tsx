"use client"

import Link from "next/link"
import { FileText, Users, Zap } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import LayeredCardWrapper from "@/components/landing/LayeredCardWrapper"
import RadarChartInteractive from "@/components/landing/RadarChartInteractive"

// ─── 데이터 ────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    title: "AI 자소서 분석",
    desc: "PDF 자소서에서 핵심 키워드·경험을 추출해 카테고리별 맞춤 질문 생성",
    icon: FileText,
    iconBg: "from-indigo-50 to-purple-50",
    iconColor: "text-indigo-500",
  },
  {
    title: "3인 패널 면접",
    desc: "HR, 기술팀장, 경영진 3개 페르소나가 동시에 면접관으로 참여",
    icon: Users,
    iconBg: "from-purple-50 to-pink-50",
    iconColor: "text-purple-500",
  },
  {
    title: "실시간 꼬리질문",
    desc: "답변을 분석해 CLARIFY·CHALLENGE·EXPLORE 유형의 꼬리질문 생성",
    icon: Zap,
    iconBg: "from-cyan-50 to-indigo-50",
    iconColor: "text-cyan-500",
  },
]

const PERSONAS = [
  {
    tag: "tag-blue",
    label: "HR",
    name: "HR 담당자",
    desc: "조직 적합성·협업 태도·인성",
    styles: ["STAR 기법", "가치관 탐색", "팀워크 검증"],
    accentColor: "border-t-blue-400",
    initial: "H",
    initialBg: "bg-blue-100 text-blue-700",
  },
  {
    tag: "tag-green",
    label: "기술",
    name: "기술팀장",
    desc: "직무 역량·문제 해결·기술 깊이",
    styles: ["기술 심층 질문", "문제 해결 검증", "구현 방법 탐색"],
    accentColor: "border-t-emerald-400",
    initial: "T",
    initialBg: "bg-emerald-100 text-emerald-600",
  },
  {
    tag: "tag-purple",
    label: "경영",
    name: "경영진",
    desc: "성장 가능성·비전·비즈니스 임팩트",
    styles: ["장기 비전 탐색", "전략적 사고", "임팩트 검증"],
    accentColor: "border-t-purple-400",
    initial: "E",
    initialBg: "bg-purple-100 text-purple-700",
  },
]

// ─── FadeInSection ────────────────────────────────────────────────────────

function FadeInSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/6">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">

          {/* 로고 */}
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M9 1L10.8 6.8H17L11.8 10.4L13.5 16.2L9 12.6L4.5 16.2L6.2 10.4L1 6.8H7.2L9 1Z"
                fill="url(#navStarGrad)"
              />
              <defs>
                <linearGradient id="navStarGrad" x1="0" y1="0" x2="18" y2="18">
                  <stop offset="0%" stopColor="#4F46E5" />
                  <stop offset="100%" stopColor="#7C3AED" />
                </linearGradient>
              </defs>
            </svg>
            <span className="text-xl font-bold gradient-text">MirAI</span>
          </div>

          {/* 중앙 링크 */}
          <div className="hidden md:flex items-center gap-6">
            {[
              { label: "기능",      href: "#features"  },
              { label: "페르소나",  href: "#personas"  },
              { label: "평가시스템", href: "#features"  },
              { label: "공채달력",  href: "#features"  },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm text-[#4B5563] hover:text-[#4F46E5] transition-colors duration-150"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* 우측 CTA */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-[#4B5563] cursor-pointer hover:text-[#4F46E5] transition-colors duration-150">
              로그인
            </span>
            <Link
              href="/resume"
              className="btn-primary rounded-full px-5 py-2 text-sm inline-block"
            >
              시작하기 →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center bg-grid">
        {/* 배경 orbs */}
        <div
          className="absolute -top-20 right-0 w-[520px] h-[520px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-10 left-0 w-[320px] h-[320px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)" }}
        />

        <div className="max-w-6xl mx-auto px-6 py-24 w-full grid grid-cols-1 md:grid-cols-2 gap-16 items-center">

          {/* 왼쪽 */}
          <div className="space-y-6">
            {/* pill 태그 */}
            <div>
              <span className="tag tag-purple inline-flex items-center gap-1.5">
                <span className="text-purple-400">✦</span>
                RAG 기반 AI 모의면접 시스템
              </span>
            </div>

            {/* 첫 번째 면접관 */}
            <p className="text-2xl md:text-3xl font-semibold text-[#6B7280] mb-1 leading-tight">
              당신의 첫 번째 면접관
            </p>
            {/* MirAI */}
            <h1 className="text-6xl md:text-7xl font-bold gradient-text leading-none mb-3">
              MirAI
            </h1>

            {/* 메인 헤드라인 */}
            <h2 className="text-2xl md:text-3xl font-bold text-[#0F0F1A] leading-snug">
              AI가 당신의{" "}
              <span className="gradient-text">진짜 실력</span>
              을 보여줍니다
            </h2>

            {/* 인용구 */}
            <p className="text-sm text-[#9CA3AF] italic border-l-2 border-purple-200 pl-3 mt-3">
              &ldquo;거울은 거짓말을 하지 않는다.&rdquo;
            </p>

            {/* 설명 */}
            <p className="text-sm text-[#6B7280] leading-relaxed">
              강점도, 약점도 데이터로 직면하고<br />면접을 제압하세요.
            </p>

            {/* 버튼 */}
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/resume"
                className="btn-primary rounded-full px-8 py-4 text-base inline-block"
              >
                무료로 시작하기 →
              </Link>
              <a
                href="#features"
                className="btn-outline rounded-full px-8 py-4 text-base inline-block"
              >
                대시보드 보기
              </a>
            </div>
          </div>

          {/* 우측 — 3중 레이어 카드 + 인터랙티브 점수 그리드 */}
          <div className="relative flex flex-col items-center justify-center">
            {/* 배경 orb */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="w-96 h-96 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)" }}
              />
            </div>

            {/* 카드 상단 메타 */}
            <div className="relative z-10 text-center mb-4">
              <p className="text-sm font-semibold text-[#1F2937]">당신의 면접 분석</p>
              <p className="text-xs text-[#7C3AED] font-semibold mt-0.5">LLM 평가 기반 8축 분석</p>
            </div>

            {/* 3중 레이어 카드 래퍼 */}
            <div className="relative z-10">
              <LayeredCardWrapper>
                <RadarChartInteractive />
              </LayeredCardWrapper>
            </div>

            {/* 하단 hint */}
            <p className="relative z-10 mt-6 text-center text-xs text-[#9CA3AF] tracking-wide">
              각 항목 위로 마우스를 이동해보세요
            </p>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section id="features" className="bg-[#F8F9FB] py-24">
        <div className="max-w-6xl mx-auto px-6">
          <FadeInSection>
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-[#111827] mb-3">면접 준비의 모든 것</h2>
              <p className="text-[#6B7280]">자소서 분석부터 실전 면접까지 원스톱</p>
            </div>
          </FadeInSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <FadeInSection key={i} delay={i * 100}>
                <div className="glass-card glass-card-hover rounded-2xl p-6 cursor-pointer h-full">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.iconBg} flex items-center justify-center mb-4`}>
                    <f.icon className={`w-6 h-6 ${f.iconColor}`} />
                  </div>
                  <h3 className="font-semibold text-[#111827] mb-2">{f.title}</h3>
                  <p className="text-sm text-[#6B7280] leading-relaxed">{f.desc}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── PERSONAS ─────────────────────────────────────────────────────── */}
      <section id="personas" className="bg-white py-24">
        <div className="max-w-6xl mx-auto px-6">
          <FadeInSection>
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-[#111827] mb-3">3인 1조 페르소나 패널 면접</h2>
              <p className="text-[#6B7280]">실제 면접처럼, 세 가지 관점에서 검증받으세요</p>
            </div>
          </FadeInSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PERSONAS.map((p, i) => (
              <FadeInSection key={i} delay={i * 80}>
                <div className={`glass-card glass-card-hover border-t-2 ${p.accentColor} rounded-2xl p-6 cursor-pointer h-full`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-full ${p.initialBg} flex items-center justify-center font-bold text-sm`}>
                      {p.initial}
                    </div>
                    <span className={`tag ${p.tag}`}>{p.label}</span>
                  </div>
                  <h3 className="font-semibold text-[#111827] mb-1">{p.name}</h3>
                  <p className="text-xs text-[#6B7280] mb-4">{p.desc}</p>
                  <ul className="space-y-1.5">
                    {p.styles.map((s, j) => (
                      <li key={j} className="text-xs text-[#6B7280] flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-[#D1D5DB] flex-shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section
        className="py-24 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)" }}
      >
        {/* 배경 orb */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)" }} />

        <div className="relative z-10 max-w-2xl mx-auto px-6 text-center">
          <FadeInSection>
            <h2 className="text-3xl font-bold text-white mb-3">
              당신의 면접, 데이터로 바꾸세요
            </h2>
            <p className="text-white/80 text-lg mb-10">
              자소서를 업로드하고 AI 면접을 지금 시작하세요
            </p>
            <Link
              href="/resume"
              className="inline-block bg-white text-[#4F46E5] font-semibold rounded-xl px-8 py-4 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200"
            >
              무료로 시작하기
            </Link>
          </FadeInSection>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-black/6 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div>
            <span className="text-lg font-bold gradient-text">MirAI</span>
            <p className="text-xs text-[#9CA3AF] mt-0.5">AI 모의면접 코치</p>
          </div>
          <div className="flex gap-6 text-sm text-[#6B7280]">
            <Link href="/resume" className="hover:text-[#4F46E5] transition-colors duration-150">
              면접 시작
            </Link>
            <Link href="/resumes" className="hover:text-[#4F46E5] transition-colors duration-150">
              내 자소서
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
