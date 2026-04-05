"use client";

import { useEffect, useRef, useState } from "react";

const PAIN_POINTS = [
  {
    icon: (
      <svg aria-hidden="true" className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
      </svg>
    ),
    title: "혼자 연습의 한계",
    description:
      "거울 앞에서 혼자 중얼거려봤자 실전 감각은 전혀 늘지 않아요. 긴장감도, 압박감도 느낄 수 없죠.",
    highlight: "실전 긴장감 없이는",
    highlightSub: "실력도 늘지 않는다",
  },
  {
    icon: (
      <svg aria-hidden="true" className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
    title: "피드백 없는 반복",
    description:
      "같은 답변을 100번 반복해도 잘못된 습관은 그대로 남아요. 어디가 문제인지조차 모른 채 시간을 낭비하게 됩니다.",
    highlight: "방향 없는 반복은",
    highlightSub: "시간 낭비일 뿐",
  },
  {
    icon: (
      <svg aria-hidden="true" className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    title: "막막한 첫 마디",
    description:
      "면접장에 들어서는 순간 머릿속이 하얘지고 준비했던 말이 사라져요. 첫 질문부터 버벅이면 분위기가 무너집니다.",
    highlight: "긴장 속에서도",
    highlightSub: "첫 마디가 승패를 가른다",
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
            }), i * 150));
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
        .la-pain-section {
          transform: translateY(32px);
          transition: transform 0.7s ease;
        }
        .la-pain-section.animate-in {
          transform: translateY(0);
        }
        .la-pain-card {
          transform: translateY(24px);
          transition: transform 0.6s ease, box-shadow 0.3s ease, border-color 0.3s ease;
        }
        .la-pain-card.card-visible {
          transform: translateY(0);
        }
        .la-pain-card:hover {
          box-shadow: 0 8px 40px rgba(13,148,136,0.15), 0 0 0 1px rgba(13,148,136,0.2);
        }
        .la-pain-divider {
          background: linear-gradient(90deg, transparent, rgba(13,148,136,0.4), transparent);
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
        className={`la-pain-section w-full bg-[#0a0a0a] py-16 md:py-24 lg:py-32 px-6 ${sectionVisible ? "animate-in" : ""}`}
      >
        <div className="max-w-5xl lg:max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold tracking-[0.2em] uppercase mb-4">
              취준생의 현실
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-white leading-[1.1] mb-4" style={{ fontFamily: "var(--font-sans)" }}>
              면접 준비, 이렇게 하고 계신가요?
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              혼자서는 해결하기 어려운 면접 준비의 한계를 많은 취준생이 겪고 있습니다.
            </p>
          </div>

          <div className="la-pain-divider h-px mb-16" aria-hidden="true" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PAIN_POINTS.map((point, i) => (
              <div
                key={point.title}
                className={`la-pain-card relative rounded-2xl border border-white/5 bg-white/[0.03] p-6 lg:p-8 cursor-default ${visibleCards[i] ? "card-visible" : ""}`}
              >
                <div className="text-4xl mb-5 text-teal-400">{point.icon}</div>

                <div className="mb-4">
                  <p className="text-xs text-gray-600 uppercase tracking-widest mb-1">많이들 말하는</p>
                  <p className="text-teal-400 font-bold italic text-sm leading-snug">
                    &ldquo;{point.highlight}
                    <br />
                    {point.highlightSub}&rdquo;
                  </p>
                </div>

                <h3 className="text-white font-bold text-xl mb-3">{point.title}</h3>

                <p className="text-gray-500 text-sm leading-relaxed">{point.description}</p>

                <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-teal-500/50 to-transparent" aria-hidden="true" />
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <p className="text-gray-500 text-base">
              이 모든 문제를{" "}
              <span className="text-teal-400 font-semibold">AI 면접관</span>
              이 해결해 드립니다.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
