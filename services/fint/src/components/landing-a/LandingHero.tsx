"use client";

import { useEffect, useRef, useState } from "react";
import { LandingCTA } from "@/components/landing/LandingCTA";

export function LandingHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  return (
    <>
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes floatUp {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
          100% { transform: translateY(0px); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(13,148,136,0.3), 0 0 60px rgba(13,148,136,0.1); }
          50% { box-shadow: 0 0 40px rgba(13,148,136,0.6), 0 0 100px rgba(13,148,136,0.2); }
        }
        .la-hero-bg {
          background: linear-gradient(135deg, #0a0a0a 0%, #0d1a1a 25%, #0a1628 50%, #0d1a1a 75%, #0a0a0a 100%);
          background-size: 400% 400%;
          animation: gradientShift 12s ease infinite;
        }
        .la-hero-section {
          transform: translateY(32px);
          transition: transform 0.8s ease;
        }
        .la-hero-section.animate-in {
          transform: translateY(0);
        }
        .la-teal-glow {
          animation: pulseGlow 3s ease-in-out infinite;
        }
        .la-float-badge {
          animation: floatUp 4s ease-in-out infinite;
        }
        .la-hero-title-gradient {
          background: linear-gradient(135deg, #ffffff 0%, #5eead4 50%, #0d9488 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .la-grid-overlay {
          background-image:
            linear-gradient(rgba(13,148,136,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(13,148,136,0.05) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      <section
        ref={sectionRef}
        className={`la-hero-section relative w-full min-h-screen flex items-center justify-center overflow-hidden ${isVisible ? "animate-in" : ""}`}
        style={{ backgroundImage: "url('/images/hero-a.png')", backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="la-grid-overlay absolute inset-0 pointer-events-none" aria-hidden="true" />

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
          <div className="w-[600px] h-[600px] rounded-full bg-teal-500/5 blur-3xl" />
        </div>

        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-teal-900/20 blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-teal-700/15 blur-2xl pointer-events-none" aria-hidden="true" />

        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 py-16 lg:py-20 text-center">
          <div className="la-float-badge inline-flex items-center gap-2 px-4 py-2 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-400 text-xs font-semibold tracking-widest uppercase mb-6">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" aria-hidden="true" />
            AI 기반 면접 준비 플랫폼
          </div>

          <h1 className="font-bold leading-[1.1] mb-4" style={{ fontFamily: "var(--font-sans)" }}>
            <span className="la-hero-title-gradient block text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl mb-2">
              AI 면접관과 함께
            </span>
            <span className="block text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl text-white">
              합격의 길을 걷다
            </span>
          </h1>

          <p className="text-gray-400 text-base sm:text-lg lg:text-xl xl:text-2xl max-w-2xl mx-auto mb-12 leading-relaxed">
            실전과 동일한 환경에서 AI 면접관과 1:1 연습하고,
            <br className="hidden sm:block" />
            즉각적인 피드백으로 합격 가능성을 높이세요.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="la-teal-glow rounded-xl">
              <LandingCTA
                text="지금 무료로 시작하기"
                variant="primary"
                className="text-lg px-10 py-4"
              />
            </div>
            <LandingCTA
              text="서비스 둘러보기"
              variant="outline"
              className="text-lg px-10 py-4 border-white/20 text-white/70 hover:border-teal-500/50 hover:text-teal-400"
            />
          </div>

          <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-12 lg:gap-20 text-center">
            {[
              { value: "10,000+", label: "누적 면접 연습" },
              { value: "94%", label: "만족도" },
              { value: "3배", label: "합격률 향상" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl lg:text-3xl xl:text-4xl font-bold text-teal-400 mb-1">{stat.value}</div>
                <div className="text-xs text-gray-500 tracking-wide uppercase">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent pointer-events-none" aria-hidden="true" />
      </section>
    </>
  );
}
