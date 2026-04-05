"use client";

import { useEffect, useRef, useState } from "react";

const PAIN_POINTS = [
  {
    icon: (
      <svg aria-hidden="true" className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
    ),
    label: "막막한 시작",
    title: "어디서부터 시작해야 할지 모르겠어요",
    desc: "면접 준비를 시작하려 해도 무엇을 공부해야 하는지, 어떤 질문이 나올지 알 수 없어 시간만 흘러갑니다.",
    accent: "bg-orange-50 text-orange-500 border-orange-100",
    tag: "bg-orange-100 text-orange-600",
  },
  {
    icon: (
      <svg aria-hidden="true" className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
    label: "반복해도 성장이 없음",
    title: "혼자 연습해도 실력이 늘지 않아요",
    desc: "거울 앞에서 연습해도 내 답변의 어디가 부족한지, 무엇을 고쳐야 하는지 객관적으로 파악하기 어렵습니다.",
    accent: "bg-blue-50 text-blue-500 border-blue-100",
    tag: "bg-blue-100 text-blue-600",
  },
  {
    icon: (
      <svg aria-hidden="true" className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
    label: "합격자와의 격차",
    title: "합격자들은 어떻게 답변하는지 알 수 없어요",
    desc: "합격자의 답변 패턴과 표현 방식을 알 수 없어, 내 답변이 기준에 부합하는지 가늠조차 하기 어렵습니다.",
    accent: "bg-purple-50 text-purple-500 border-purple-100",
    tag: "bg-purple-100 text-purple-600",
  },
];

export function LandingPainPoints() {
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
            }), i * 120));
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
    <section ref={sectionRef} className="w-full bg-white px-6 py-16 md:py-24 lg:py-32">
      <style>{`
        .lb-pain-animate {
          transform: translateY(28px);
          transition: transform 0.55s ease;
        }
        .lb-pain-animate.animate-in {
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
        <div className={`lb-pain-animate text-center flex flex-col gap-3 ${sectionVisible ? "animate-in" : ""}`}>
          <span className="text-xs font-bold text-[#0D9488] tracking-[0.2em] uppercase">
            혼자 준비할 때 겪는 문제
          </span>
          <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 leading-[1.1]">
            면접 준비, 이런 어려움 있으셨나요?
          </h2>
          <p className="text-gray-500 text-base md:text-lg max-w-xl mx-auto">
            많은 취준생들이 같은 벽에 부딪힙니다. LWW는 그 벽을 허뭅니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PAIN_POINTS.map((point, i) => (
            <div
              key={point.label}
              className={`lb-pain-card lb-pain-animate bg-gray-50 rounded-2xl border border-gray-100 shadow-sm p-5 lg:p-7 flex flex-col gap-4 hover:shadow-md transition-shadow duration-200 ${visibleCards[i] ? "animate-in" : ""}`}
            >
              <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${point.accent}`}>
                {point.icon}
              </div>
              <div className="flex flex-col gap-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${point.tag}`}>
                  {point.label}
                </span>
                <h3 className="text-base font-bold text-gray-900 leading-snug">
                  {point.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {point.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
