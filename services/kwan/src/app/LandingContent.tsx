'use client'

import Link from 'next/link'
import { useRef, useEffect, useState } from 'react'
import {
  FileText, Users, Zap, MessageCircle, PuzzleIcon,
  Brain, Target, Handshake, Rocket, Lightbulb, TrendingUp,
} from 'lucide-react'

/* ─── Data ─────────────────────────────────────────── */

const FEATURES = [
  {
    icon: '📄',
    title: 'AI 자소서 분석',
    desc: 'PDF 자소서에서 핵심 키워드·경험을 추출해 카테고리별 맞춤 질문 생성',
  },
  {
    icon: '👥',
    title: '3인 패널 면접',
    desc: 'HR·기술팀장·경영진 3개 페르소나가 동시에 면접관으로 참여',
  },
  {
    icon: '⚡',
    title: '실시간 꼬리질문',
    desc: '답변을 분석해 CLARIFY·CHALLENGE·EXPLORE 유형 꼬리질문 자동 생성',
  },
]

const PERSONAS = [
  {
    initial: 'H', color: 'blue',
    title: 'HR 담당자', sub: '조직 적합성·협업 태도·인성',
    styles: ['STAR 기법', '가치관 탐색', '팀워크 검증'],
    avatarBg: '#3B82F6',
  },
  {
    initial: 'T', color: 'green',
    title: '기술팀장', sub: '직무 역량·문제 해결·기술 깊이',
    styles: ['기술 심층 질문', '문제 해결 검증', '구현 방법 탐색'],
    avatarBg: '#34D399',
  },
  {
    initial: 'E', color: 'amber',
    title: '경영진', sub: '성장 가능성·비전·비즈니스 임팩트',
    styles: ['장기 비전 탐색', '전략적 사고', '임팩트 검증'],
    avatarBg: '#F59E0B',
  },
]

const EVAL_AXES = [
  { icon: MessageCircle, name: '의사소통', desc: '의도가 명확하게 전달됐는가' },
  { icon: PuzzleIcon,    name: '문제해결',   desc: '문제를 구조적으로 접근했는가' },
  { icon: Brain,         name: '논리적 사고', desc: '답변의 흐름이 일관적인가' },
  { icon: Target,        name: '직무 전문성', desc: '직무 관련 지식이 정확한가' },
  { icon: Handshake,     name: '조직 적합성', desc: '조직 문화와 가치에 부합하는가' },
  { icon: Rocket,        name: '리더십',     desc: '주도적으로 이끌어간 경험이 있는가' },
  { icon: Lightbulb,     name: '창의성',     desc: '새로운 시각으로 접근했는가' },
  { icon: TrendingUp,    name: '성실성',     desc: '꾸준히 노력한 과정이 드러나는가' },
]

const HERO_SCORES = [
  { label: '의사소통', score: 82 },
  { label: '문제해결', score: 75 },
  { label: '논리적 사고', score: 88 },
  { label: '직무 전문성', score: 70 },
]

/* ─── FadeIn helper ────────────────────────────────── */

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold: 0, rootMargin: '0px 0px -10px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.98)',
        transition: `opacity 0.3s ease ${delay}ms, transform 0.3s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

/* ─── Main ──────────────────────────────────────────── */

export default function LandingContent({ isLoggedIn }: { isLoggedIn: boolean }) {
  const startHref = isLoggedIn ? '/upload' : '/login'

  return (
    <div style={{ background: 'var(--kwan-bg)', color: 'var(--kwan-text)', minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <nav
        className="sticky top-0 z-50 border-b"
        style={{ background: 'var(--kwan-navbar)', borderColor: 'var(--kwan-border)' }}
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span style={{ color: 'var(--kwan-teal)', fontWeight: 700, fontSize: '1.125rem' }}>MirAI</span>
          <div className="nav-links">
            {[['기능', '#features'], ['페르소나', '#personas'], ['평가시스템', '#evaluation']].map(([label, href]) => (
              <a key={href} href={href}
                style={{ fontSize: '0.8125rem', color: 'var(--kwan-text-2)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--kwan-teal)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--kwan-text-2)')}
              >
                {label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {!isLoggedIn && (
              <Link href="/login"
                style={{ fontSize: '0.8125rem', color: 'var(--kwan-text-2)', textDecoration: 'none' }}
              >
                로그인
              </Link>
            )}
            <Link href={startHref} className="btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>
              시작하기 →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="hero-grid">

          {/* Main hero cell */}
          <div
            className="matte-card p-10 flex flex-col justify-between"
            style={{ minHeight: '460px' }}
          >
            <div className="space-y-5">
              <span className="tag tag-teal">✦ RAG 기반 AI 모의면접 시스템</span>
              <div>
                <p style={{ fontSize: '1.125rem', color: 'var(--kwan-text-2)', marginBottom: '0.25rem' }}>
                  당신의 첫 번째 면접관
                </p>
                <h1 style={{ fontSize: '4.5rem', fontWeight: 800, color: 'var(--kwan-text)', lineHeight: 1, marginBottom: '0.75rem' }}>
                  MirAI
                </h1>
                <h2 style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--kwan-text)', lineHeight: 1.3 }}>
                  AI가 당신의{' '}
                  <span style={{ color: 'var(--kwan-teal)' }}>진짜 실력</span>
                  을 보여줍니다
                </h2>
              </div>
              <p style={{ fontSize: '0.9375rem', color: 'var(--kwan-text-2)', lineHeight: 1.7 }}>
                강점도, 약점도 데이터로 직면하고<br />면접을 제압하세요.
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--kwan-text-muted)', fontStyle: 'italic', borderLeft: '2px solid var(--kwan-teal)', paddingLeft: '0.75rem' }}>
                &ldquo;거울은 거짓말을 하지 않는다.&rdquo;
              </p>
            </div>
            <div className="flex gap-3 flex-wrap mt-6">
              <Link href={startHref} className="btn-primary" style={{ padding: '0.875rem 2rem', fontSize: '0.9375rem' }}>
                무료로 시작하기 →
              </Link>
              {!isLoggedIn && (
                <Link href="/api/guest/start" className="btn-outline" style={{ padding: '0.875rem 2rem', fontSize: '0.9375rem' }}>
                  비회원으로 시작하기
                </Link>
              )}
              {isLoggedIn && (
                <Link href="/dashboard" className="btn-outline" style={{ padding: '0.875rem 2rem', fontSize: '0.9375rem' }}>
                  대시보드 보기
                </Link>
              )}
            </div>
          </div>

          {/* Right col — stacked two cells */}
          <div className="flex flex-col gap-4">
            {/* Score preview */}
            <div className="matte-card p-5 flex-1">
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--kwan-text-2)', marginBottom: '1rem' }}>
                면접 분석 미리보기
              </p>
              <div className="space-y-3">
                {HERO_SCORES.map(({ label, score }) => (
                  <div key={label} className="axis-row">
                    <span className="axis-label">{label}</span>
                    <div className="axis-bar-track">
                      <div
                        className={`axis-bar-fill ${score >= 80 ? 'high' : score >= 60 ? 'mid' : 'low'}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    <span className="axis-score" style={{ color: score >= 80 ? 'var(--kwan-teal)' : 'var(--kwan-amber)' }}>
                      {score}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Personas preview */}
            <div className="matte-card p-5 flex-1">
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--kwan-text-2)', marginBottom: '0.875rem' }}>
                3인 AI 면접관
              </p>
              <div className="space-y-2">
                {PERSONAS.map((p) => (
                  <div key={p.initial} className="matte-elevated flex items-center gap-3 p-2">
                    <div
                      className="flex items-center justify-center rounded-full text-sm font-bold shrink-0"
                      style={{ width: 32, height: 32, background: p.avatarBg, color: p.color === 'amber' ? '#0F1724' : '#E8ECF1' }}
                    >
                      {p.initial}
                    </div>
                    <div>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{p.title}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--kwan-text-muted)' }}>{p.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ background: 'var(--kwan-surface)' }} className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn>
            <div className="mb-12">
              <p className="section-label mb-2">Features</p>
              <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--kwan-text)' }}>
                면접 준비의 새로운 기준
              </h2>
              <p style={{ fontSize: '0.9375rem', color: 'var(--kwan-text-2)', marginTop: '0.5rem' }}>
                이력서 분석부터 실전 면접, 데이터 피드백까지 — 하나의 AI가 모두 처리합니다.
              </p>
            </div>
          </FadeIn>
          <div className="grid-3-md">
            {FEATURES.map((f, i) => (
              <FadeIn key={i} delay={i * 60}>
                <div className="matte-card matte-card-hover p-6 h-full">
                  <span style={{ fontSize: '1.75rem' }}>{f.icon}</span>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--kwan-text)', margin: '0.875rem 0 0.375rem' }}>
                    {f.title}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--kwan-text-2)', lineHeight: 1.65 }}>
                    {f.desc}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── PERSONAS ── */}
      <section id="personas" style={{ background: 'var(--kwan-bg)' }} className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn>
            <div className="mb-12">
              <p className="section-label mb-2">Personas</p>
              <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--kwan-text)' }}>
                실제 면접처럼,{' '}
                <span style={{ color: 'var(--kwan-teal)' }}>더 실전같이</span>
              </h2>
            </div>
          </FadeIn>
          <div className="grid-3-md" style={{ marginBottom: '1rem' }}>
            {PERSONAS.map((p, i) => (
              <FadeIn key={i} delay={i * 60}>
                <div className={`persona-card ${p.color} h-full`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="flex items-center justify-center rounded-full font-bold"
                      style={{ width: 40, height: 40, background: p.avatarBg, color: p.color === 'amber' ? '#0F1724' : '#E8ECF1', fontSize: '0.875rem' }}
                    >
                      {p.initial}
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{p.title}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--kwan-text-muted)' }}>{p.sub}</p>
                    </div>
                  </div>
                  <ul className="space-y-1.5 mt-2">
                    {p.styles.map((s) => (
                      <li key={s} style={{ fontSize: '0.8125rem', color: 'var(--kwan-text-2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--kwan-text-muted)', flexShrink: 0, display: 'inline-block' }} />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeIn>
            ))}
          </div>
          {/* Interview modes */}
          <div className="grid-2-md">
            {[
              { icon: '⚡', title: '실전 모드', color: 'teal', desc: '면접처럼 진행, 즉각 피드백 없음', items: ['실전처럼 몰입', '즉각 피드백 없음', '전체 면접 완주'] },
              { icon: '📝', title: '연습 모드', color: 'amber', desc: '즉각 AI 피드백, 재답변 가능', items: ['즉각 AI 피드백', '재답변 가능', '약점 집중 훈련'] },
            ].map((m, i) => (
              <FadeIn key={i} delay={i * 60}>
                <div
                  className="matte-card matte-card-hover p-6"
                  style={{ borderLeft: `3px solid ${m.color === 'teal' ? 'var(--kwan-teal)' : 'var(--kwan-amber)'}` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: '1.25rem' }}>{m.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>{m.title}</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--kwan-text-2)', marginBottom: '0.75rem' }}>{m.desc}</p>
                  <div className="flex gap-3 flex-wrap">
                    {m.items.map((item) => (
                      <span key={item} className={`tag tag-${m.color === 'teal' ? 'teal' : 'amber'}`}>{item}</span>
                    ))}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── EVALUATION ── */}
      <section id="evaluation" style={{ background: 'var(--kwan-surface)' }} className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn>
            <div className="mb-12">
              <p className="section-label mb-2">Evaluation</p>
              <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--kwan-text)' }}>
                단순 점수가 아닌,{' '}
                <span style={{ color: 'var(--kwan-teal)' }}>정밀한 분석</span>
              </h2>
              <p style={{ fontSize: '0.9375rem', color: 'var(--kwan-text-2)', marginTop: '0.5rem' }}>
                LLM-as-a-Judge 기술로 8개 평가 축을 독립적으로 분석합니다.
              </p>
            </div>
          </FadeIn>
          {/* Single large bento card with 4x2 inner grid */}
          <FadeIn>
            <div className="matte-card p-3">
              <div className="grid-2-4-md">
                {EVAL_AXES.map((axis, i) => (
                  <div key={i} className="matte-elevated p-4 matte-card-hover">
                    <axis.icon className="mb-3" style={{ width: 22, height: 22, color: 'var(--kwan-teal)' }} />
                    <p style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.25rem' }}>{axis.name}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--kwan-text-muted)', lineHeight: 1.5 }}>{axis.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20" style={{ background: 'var(--kwan-bg)' }}>
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn>
            <div
              className="matte-card text-center py-16 px-8"
              style={{ background: 'var(--kwan-teal-dim)', borderColor: 'rgba(45,212,191,0.25)' }}
            >
              <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.75rem' }}>
                당신의 면접, 데이터로 바꾸세요
              </h2>
              <p style={{ fontSize: '1rem', color: 'var(--kwan-text-2)', marginBottom: '2rem' }}>
                자소서를 업로드하고 AI 면접을 지금 시작하세요
              </p>
              <Link href={startHref} className="btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1rem' }}>
                무료로 시작하기
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t" style={{ background: 'var(--kwan-navbar)', borderColor: 'var(--kwan-border)' }}>
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="footer-row" style={{ paddingBottom: '2rem', borderBottom: '1px solid var(--kwan-border)' }}>
            <div className="space-y-1.5">
              <p style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--kwan-teal)' }}>MirAI</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--kwan-text-muted)' }}>AI 모의면접 코치</p>
              <a href="mailto:mirainterview5@gmail.com" style={{ fontSize: '0.75rem', color: 'var(--kwan-text-2)', textDecoration: 'none' }}>
                mirainterview5@gmail.com
              </a>
            </div>
            <div className="flex gap-12 text-sm">
              <div className="space-y-2">
                <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--kwan-text-muted)' }}>서비스</p>
                <div className="flex flex-col gap-1.5">
                  <Link href={startHref} style={{ color: 'var(--kwan-text-2)', textDecoration: 'none', fontSize: '0.875rem' }}>면접 시작</Link>
                  <Link href={isLoggedIn ? '/dashboard' : '/login'} style={{ color: 'var(--kwan-text-2)', textDecoration: 'none', fontSize: '0.875rem' }}>내 자소서</Link>
                </div>
              </div>
              <div className="space-y-2">
                <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--kwan-text-muted)' }}>문의</p>
                <a href="mailto:mirainterview5@gmail.com" style={{ color: 'var(--kwan-text-2)', textDecoration: 'none', fontSize: '0.875rem' }}>이메일 문의</a>
              </div>
            </div>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--kwan-text-muted)', marginTop: '1.5rem' }}>
            &copy; 2026 MirAI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
