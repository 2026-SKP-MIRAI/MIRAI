"use client";

import { useEffect, useRef, useState } from "react";
import { LandingCTA } from "@/components/landing/LandingCTA";

export function LandingHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visibleItems, setVisibleItems] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    requestAnimationFrame(() => setVisibleItems(true));
  }, []);

  return (
    <section
      ref={sectionRef}
      className="w-full bg-white px-6 py-16 md:py-24 lg:py-32 min-h-[70vh] md:min-h-screen flex items-center"
    >
      <style>{`
        .lb-hero-animate {
          transform: translateY(24px);
          transition: transform 0.6s ease;
        }
        .lb-hero-animate.animate-in {
          transform: translateY(0);
        }
        .lb-hero-animate:nth-child(2) { transition-delay: 0.1s; }
        .lb-hero-animate:nth-child(3) { transition-delay: 0.2s; }
        .lb-hero-animate:nth-child(4) { transition-delay: 0.3s; }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      <div className="w-full max-w-6xl mx-auto flex flex-col-reverse md:flex-row items-center gap-12 md:gap-8 lg:gap-16">
        <div className="flex-1 flex flex-col gap-6 text-center md:text-left md:pr-4 lg:pr-8">
          <div className={`lb-hero-animate ${visibleItems ? "animate-in" : ""}`}>
            <span className="inline-block px-3 py-1 rounded-full bg-teal-50 text-[#0D9488] text-sm font-semibold tracking-wide mb-4">
              AI 면접 코치
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 leading-[1.1]">
              취업 면접,<br />
              더 이상 혼자 준비하지 마세요
            </h1>
          </div>

          <p className={`lb-hero-animate text-sm md:text-base lg:text-lg xl:text-xl text-gray-500 leading-relaxed max-w-md mx-auto md:mx-0 ${visibleItems ? "animate-in" : ""}`}>
            AI가 실전처럼 질문하고, 내 답변을 분석해 구체적인 피드백을 드립니다.
            합격자 수준의 답변을 만들어 가세요.
          </p>

          <div className={`lb-hero-animate flex flex-col sm:flex-row gap-3 justify-center md:justify-start ${visibleItems ? "animate-in" : ""}`}>
            <LandingCTA text="무료로 시작하기" variant="primary" />
            <a
              href="#features"
              className="inline-block px-8 py-4 rounded-xl font-semibold text-base text-gray-600 border border-gray-200 hover:border-[#0D9488] hover:text-[#0D9488] transition-all duration-200"
            >
              기능 살펴보기
            </a>
          </div>

          <div className={`lb-hero-animate flex items-center gap-6 justify-center md:justify-start pt-2 ${visibleItems ? "animate-in" : ""}`}>
            <div className="flex flex-col items-center md:items-start">
              <span className="text-2xl lg:text-3xl font-black text-gray-900">94%</span>
              <span className="text-xs text-gray-400">만족도</span>
            </div>
            <div className="w-px h-10 bg-gray-200" aria-hidden="true" />
            <div className="flex flex-col items-center md:items-start">
              <span className="text-2xl lg:text-3xl font-black text-gray-900">10,000+</span>
              <span className="text-xs text-gray-400">면접 연습 횟수</span>
            </div>
            <div className="w-px h-10 bg-gray-200" aria-hidden="true" />
            <div className="flex flex-col items-center md:items-start">
              <span className="text-2xl lg:text-3xl font-black text-gray-900">3배</span>
              <span className="text-xs text-gray-400">합격률 향상</span>
            </div>
          </div>
        </div>

        <div className={`lb-hero-animate flex-1 flex justify-center md:justify-end w-full ${visibleItems ? "animate-in" : ""}`}>
          <div className="relative w-full max-w-xs md:max-w-sm lg:max-w-md">
            <div className="absolute -top-4 -right-4 w-48 h-48 rounded-full bg-teal-50 -z-10" aria-hidden="true" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 rounded-full bg-gray-100 -z-10" aria-hidden="true" />

            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                <div className="w-10 h-10 rounded-full bg-[#0D9488] flex items-center justify-center text-white font-bold text-sm">
                  AI
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">AI 면접관</p>
                  <p className="text-xs text-emerald-500">온라인</p>
                </div>
                <div className="ml-auto w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
              </div>

              <div className="flex flex-col gap-3">
                <div className="bg-gray-50 rounded-xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                  <p className="text-sm text-gray-700">
                    &ldquo;자신의 강점 3가지를 구체적인 경험과 함께 말씀해 주세요.&rdquo;
                  </p>
                </div>

                <div className="bg-[#0D9488] rounded-xl rounded-tr-sm px-4 py-3 max-w-[85%] self-end">
                  <p className="text-sm text-white">
                    &ldquo;저의 강점은 문제 해결 능력입니다...&rdquo;
                  </p>
                </div>

                <div className="bg-teal-50 rounded-xl border border-teal-100 px-4 py-3">
                  <p className="text-xs font-semibold text-[#0D9488] mb-1">AI 피드백</p>
                  <p className="text-xs text-gray-600">
                    답변 구조가 명확합니다. STAR 기법을 활용하면 더욱 설득력 있는 답변이 됩니다.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <div className="flex-1 bg-gray-50 rounded-full px-4 py-2 text-xs text-gray-400">
                  답변을 입력하세요...
                </div>
                <button aria-label="답변 보내기" className="w-8 h-8 rounded-full bg-[#0D9488] flex items-center justify-center">
                  <svg aria-hidden="true" className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
