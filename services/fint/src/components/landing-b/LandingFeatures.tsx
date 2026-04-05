"use client";

import { useEffect, useRef, useState } from "react";

const FEATURES = [
  {
    step: "01",
    icon: (
      <svg aria-hidden="true" className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
          d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
    title: "AI 면접 시뮬레이션",
    desc: "실제 면접처럼 AI 면접관이 직군별 맞춤 질문을 던집니다. 긴장감 있는 실전 연습으로 당일 떨림을 줄이세요.",
    highlights: ["직군별 맞춤 질문", "실시간 대화형 진행", "무제한 반복 연습"],
  },
  {
    step: "02",
    icon: (
      <svg aria-hidden="true" className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
          d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
    title: "맞춤형 피드백",
    desc: "내 답변의 강점과 약점을 즉시 분석합니다. 논리 구조, 표현력, 핵심 키워드까지 세밀하게 코칭합니다.",
    highlights: ["논리 구조 분석", "표현력 점수", "개선 방향 제시"],
  },
  {
    step: "03",
    icon: (
      <svg aria-hidden="true" className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
          d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
      </svg>
    ),
    title: "합격 전략 코칭",
    desc: "합격자 답변 패턴을 학습한 AI가 내 답변을 업그레이드합니다. 취약 영역을 집중 공략해 단기간 실력을 높이세요.",
    highlights: ["합격자 패턴 분석", "취약점 집중 훈련", "맞춤 학습 로드맵"],
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
            }), i * 130));
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
    <section
      id="features"
      ref={sectionRef}
      className="w-full bg-white px-6 py-16 md:py-24 lg:py-32"
    >
      <style>{`
        .lb-feature-animate {
          transform: translateY(28px);
          transition: transform 0.55s ease;
        }
        .lb-feature-animate.animate-in {
          transform: translateY(0);
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      <div className="max-w-5xl lg:max-w-6xl mx-auto flex flex-col gap-12">
        <div className={`lb-feature-animate text-center flex flex-col gap-3 ${sectionVisible ? "animate-in" : ""}`}>
          <span className="text-sm font-semibold text-[#0D9488] tracking-[0.15em] uppercase">
            LWW 핵심 기능
          </span>
          <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 leading-[1.1]">
            합격을 만드는 세 가지 무기
          </h2>
          <p className="text-gray-500 text-base md:text-lg max-w-xl mx-auto">
            AI가 당신의 전담 면접 코치가 됩니다. 분석하고, 피드백하고, 함께 성장합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.step}
              className={`lb-feature-card lb-feature-animate group relative bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:p-8 flex flex-col gap-5 hover:shadow-md hover:border-teal-100 transition-shadow duration-200 overflow-hidden ${visibleCards[i] ? "animate-in" : ""}`}
            >
              <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full bg-teal-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-0" aria-hidden="true" />

              <div className="relative z-10 flex items-start justify-between">
                <div className="w-14 h-14 rounded-2xl bg-teal-50 text-[#0D9488] flex items-center justify-center group-hover:bg-[#0D9488] group-hover:text-white transition-all duration-300">
                  {feature.icon}
                </div>
                <span className="text-5xl font-black text-gray-50 group-hover:text-teal-100 transition-colors duration-300 select-none" aria-hidden="true">
                  {feature.step}
                </span>
              </div>

              <div className="relative z-10 flex flex-col gap-3">
                <h3 className="text-lg font-bold text-gray-900">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {feature.desc}
                </p>
              </div>

              <ul className="relative z-10 flex flex-col gap-2">
                {feature.highlights.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-4 h-4 rounded-full bg-teal-100 text-[#0D9488] flex items-center justify-center flex-shrink-0">
                      <svg aria-hidden="true" className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
