"use client";

import { useEffect, useRef, useState } from "react";

const FEATURES = [
  {
    number: "01",
    title: "AI 면접관",
    subtitle: "실전과 동일한 압박감",
    description:
      "수백만 건의 면접 데이터로 학습한 AI가 실제 면접관처럼 질문합니다. 산업별, 직무별 맞춤 질문으로 실전 감각을 키우세요.",
    highlights: ["직무별 맞춤 질문", "실전 압박 모드", "다양한 면접 유형"],
    color: "from-teal-500/20 to-teal-900/5",
    borderColor: "border-teal-500/20",
    tagColor: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  },
  {
    number: "02",
    title: "즉각 피드백",
    subtitle: "답변 직후 상세 분석",
    description:
      "답변이 끝나는 즉시 논리성, 구체성, 전달력을 분석합니다. 어떤 부분이 부족했는지 명확히 파악하고 바로 개선할 수 있어요.",
    highlights: ["논리 구조 분석", "키워드 적절성", "개선 포인트 제시"],
    color: "from-purple-500/20 to-purple-900/5",
    borderColor: "border-purple-500/20",
    tagColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  {
    number: "03",
    title: "맞춤 질문",
    subtitle: "내 이력서 기반 질문 생성",
    description:
      "이력서와 자기소개서를 분석해 나에게 특화된 질문을 생성합니다. 면접관이 파고들 수 있는 약점을 미리 파악하고 대비하세요.",
    highlights: ["이력서 기반 분석", "예상 꼬리질문", "취약점 사전 파악"],
    color: "from-blue-500/20 to-blue-900/5",
    borderColor: "border-blue-500/20",
    tagColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
];

export function LandingFeatures() {
  const sectionRef = useRef<HTMLElement>(null);
  const [sectionVisible, setSectionVisible] = useState(false);
  const [visibleCards, setVisibleCards] = useState([false, false, false]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSectionVisible(true);
          [0, 1, 2].forEach((i) => {
            timers.push(setTimeout(() => setVisibleCards((prev) => {
              const next = [...prev];
              next[i] = true;
              return next;
            }), i * 200));
          });
          observer.unobserve(el);
        }
      },
      { threshold: 0, rootMargin: "0px 0px -20px 0px" }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <>
      <style>{`
        .la-features-section {
          transform: translateY(32px);
          transition: transform 0.7s ease;
        }
        .la-features-section.animate-in {
          transform: translateY(0);
        }
        .la-feature-card {
          transform: translateY(28px);
          transition: transform 0.65s ease, box-shadow 0.3s ease;
        }
        .la-feature-card.feature-visible {
          transform: translateY(0);
        }
        .la-feature-card.feature-visible:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.4);
        }
        .la-feature-number {
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum";
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
        className={`la-features-section w-full bg-[#0d0d0d] py-16 md:py-24 lg:py-32 px-6 ${sectionVisible ? "animate-in" : ""}`}
      >
        <div className="max-w-5xl lg:max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm font-medium tracking-[0.15em] mb-4">
              핵심 기능
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-white leading-[1.1] mb-4" style={{ fontFamily: "var(--font-sans)" }}>
              합격을 만드는 세 가지 기능
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              단순 연습이 아닌, 데이터 기반의 체계적인 면접 준비 시스템
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <div
                key={feature.number}
                className={`la-feature-card relative rounded-2xl border ${feature.borderColor} bg-gradient-to-b ${feature.color} p-6 lg:p-8 overflow-hidden ${visibleCards[i] ? "feature-visible" : ""}`}
              >
                <span className="la-feature-number absolute top-4 right-6 text-7xl font-black text-white/[0.06] select-none" aria-hidden="true">
                  {feature.number}
                </span>

                <div className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold mb-5 ${feature.tagColor}`}>
                  {feature.number}
                </div>

                <h3 className="text-white font-bold text-2xl mb-1">{feature.title}</h3>
                <p className="text-gray-500 text-sm mb-4">{feature.subtitle}</p>

                <p className="text-gray-400 text-sm leading-relaxed mb-6">{feature.description}</p>

                <ul className="space-y-2">
                  {feature.highlights.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-gray-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
