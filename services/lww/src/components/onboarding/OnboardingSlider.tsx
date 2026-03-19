"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const slides = [
  {
    id: 0,
    type: "splash" as const,
    emoji: "✨",
    title: "lww",
    subtitle: "AI 모의면접",
    desc: "",
  },
  {
    id: 1,
    type: "intro" as const,
    emoji: "💬",
    title: "🤖 AI 면접관과\n채팅으로 연습",
    subtitle: "채팅처럼 편하게, 실전처럼 날카롭게",
    desc: "\"안녕하세요! 오늘\n면접 준비 됐나요?\"",
  },
  {
    id: 2,
    type: "result" as const,
    emoji: "📊",
    title: "📊 즉각 결과 리포트",
    subtitle: "면접 완료 → 리포트 → 개선 포인트 → 다음 면접",
    desc: "\"이렇게 대답하면\n더 좋았을 텐데\"",
  },
];

const slideGradients = [
  { from: "#0D9488", to: "#0F766E" },
  { from: "#0F766E", to: "#134E4A" },
  { from: "#0D9488", to: "#164E63" },
];

export function OnboardingSlider() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoTransitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (currentSlide === 0) {
      autoTransitionRef.current = setTimeout(() => {
        scrollToSlide(1);
      }, 1500);
    }
    return () => {
      if (autoTransitionRef.current) clearTimeout(autoTransitionRef.current);
    };
  }, [currentSlide]);

  const scrollToSlide = (index: number) => {
    if (scrollRef.current) {
      const width = scrollRef.current.clientWidth;
      scrollRef.current.scrollTo({ left: width * index, behavior: "smooth" });
    }
    setCurrentSlide(index);
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const width = scrollRef.current.clientWidth;
      const newIndex = Math.round(scrollRef.current.scrollLeft / width);
      if (newIndex !== currentSlide) {
        setCurrentSlide(newIndex);
      }
    }
  };

  const handleStart = () => {
    localStorage.setItem("onboarding_done", "true");
    router.push("/onboarding");
  };

  const handleSkip = () => {
    localStorage.setItem("onboarding_done", "true");
    router.push("/onboarding");
  };

  const grad = slideGradients[currentSlide];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col transition-all duration-700"
      style={{ background: `linear-gradient(to bottom, ${grad.from}, ${grad.to})` }}
    >
      {/* Decorative blurred circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-24 -right-24 w-80 h-80 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #ffffff 0%, transparent 70%)", filter: "blur(40px)" }}
        />
        <div
          className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #ffffff 0%, transparent 70%)", filter: "blur(32px)" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, #ffffff 0%, transparent 70%)", filter: "blur(60px)" }}
        />
      </div>

      {/* 건너뛰기 버튼 */}
      {currentSlide > 0 && (
        <button
          onClick={handleSkip}
          className="absolute top-10 right-4 z-10 text-sm font-medium text-white/75 min-h-[44px] min-w-[44px] px-4 py-2.5 rounded-full backdrop-blur-sm flex items-center"
          style={{ background: "rgba(255,255,255,0.12)" }}
        >
          건너뛰기
        </button>
      )}

      {/* 슬라이드 컨테이너 */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 flex overflow-x-auto snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {slides.map((slide) => (
          <div
            key={slide.id}
            className={cn(
              "min-w-full h-full snap-start flex flex-col items-center px-8 text-center gap-7 relative",
              slide.type === "splash"
                ? "justify-center"
                : "justify-center"
            )}
            style={slide.type !== "splash" ? { paddingBottom: "200px" } : undefined}
          >
            {slide.type === "splash" && (
              <>
                {/* App icon with sparkle animation */}
                <div className="relative flex items-center justify-center">
                  {/* Outer glow ring */}
                  <div
                    className="absolute w-44 h-44 rounded-[40px] opacity-30 animate-pulse"
                    style={{ background: "rgba(255,255,255,0.25)", filter: "blur(16px)" }}
                  />
                  {/* Icon */}
                  <div
                    className="relative w-32 h-32 rounded-[32px] flex items-center justify-center"
                    style={{
                      background: "rgba(255,255,255,0.22)",
                      backdropFilter: "blur(12px)",
                      boxShadow: "0 24px 64px rgba(0,0,0,0.25), 0 0 0 1.5px rgba(255,255,255,0.2) inset",
                    }}
                  >
                    <span className="text-6xl" style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.2))" }}>✨</span>
                    {/* Sparkle dots */}
                    <span
                      className="absolute -top-3 -right-3 text-2xl animate-bounce"
                      style={{ animationDuration: "1.4s" }}
                    >⭐</span>
                    <span
                      className="absolute -bottom-2 -left-3 text-xl animate-bounce"
                      style={{ animationDuration: "1.8s", animationDelay: "0.3s" }}
                    >✦</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h1
                    className="text-7xl font-black text-white tracking-tight"
                    style={{ textShadow: "0 4px 24px rgba(0,0,0,0.18)" }}
                  >
                    lww
                  </h1>
                  <p className="text-2xl font-semibold text-white/85">AI 모의면접</p>
                </div>
              </>
            )}

            {slide.type === "intro" && (
              <>
                <div className="space-y-3 w-full">
                  <h1 className="text-2xl font-bold text-white whitespace-pre-line" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.15)" }}>
                    {slide.title}
                  </h1>
                  <p className="text-base font-medium text-white/80">{slide.subtitle}</p>
                  {slide.desc && (
                    <p className="text-sm text-white/60 whitespace-pre-line leading-relaxed">
                      {slide.desc}
                    </p>
                  )}
                </div>

                {/* Mock chat UI illustration */}
                <div className="w-full max-w-xs flex flex-col gap-3">
                  {/* AI bubble (left) */}
                  <div className="flex items-end gap-2 self-start">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.25)", backdropFilter: "blur(8px)" }}
                    >
                      🤖
                    </div>
                    <div
                      className="max-w-[200px] px-4 py-3 rounded-2xl rounded-bl-sm text-left"
                      style={{
                        background: "rgba(255,255,255,0.18)",
                        backdropFilter: "blur(10px)",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
                      }}
                    >
                      <p className="text-sm text-white leading-snug break-words">안녕하세요! 오늘 면접 준비 됐나요? 😊</p>
                    </div>
                  </div>

                  {/* User bubble (right) */}
                  <div className="flex items-end gap-2 self-end">
                    <div
                      className="max-w-[200px] px-4 py-3 rounded-2xl rounded-br-sm text-left"
                      style={{
                        background: "rgba(255,255,255,0.92)",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
                      }}
                    >
                      <p className="text-sm leading-snug break-words" style={{ color: "#0F766E" }}>
                        안녕하세요! 저는 3년차 개발자로...
                      </p>
                    </div>
                  </div>

                  {/* AI bubble 2 (left) */}
                  <div className="flex items-end gap-2 self-start">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.25)", backdropFilter: "blur(8px)" }}
                    >
                      🤖
                    </div>
                    <div
                      className="max-w-[200px] px-4 py-3 rounded-2xl rounded-bl-sm text-left"
                      style={{
                        background: "rgba(255,255,255,0.18)",
                        backdropFilter: "blur(10px)",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
                      }}
                    >
                      <p className="text-sm text-white leading-snug break-words">좋아요! 구체적인 성과를 추가해보면 어떨까요? ✨</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {slide.type === "result" && (
              <>
                <div className="space-y-3 w-full">
                  <h1 className="text-2xl font-bold text-white whitespace-pre-line" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.15)" }}>
                    {slide.title}
                  </h1>
                  <p className="text-base font-medium text-white/80">{slide.subtitle}</p>
                  {slide.desc && (
                    <p className="text-sm text-white/60 whitespace-pre-line leading-relaxed">
                      {slide.desc}
                    </p>
                  )}
                </div>

                {/* Score visualization */}
                <div
                  className="w-full max-w-xs rounded-2xl p-5 flex flex-col gap-4"
                  style={{
                    background: "rgba(255,255,255,0.14)",
                    backdropFilter: "blur(16px)",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.15) inset",
                  }}
                >
                  <p className="text-xs font-bold text-white/60 uppercase tracking-widest text-left">면접 결과 리포트</p>

                  {[
                    { label: "논리력", score: 82, color: "#34D399" },
                    { label: "표현력", score: 74, color: "#60A5FA" },
                    { label: "자신감", score: 80, color: "#FBBF24" },
                  ].map(({ label, score, color }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-white/80 w-14 text-left flex-shrink-0">{label}</span>
                      <div className="flex-1 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>
                        <div
                          className="h-2 rounded-full transition-all duration-1000"
                          style={{ width: `${score}%`, background: color, boxShadow: `0 0 8px ${color}88` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-white w-8 text-right">{score}</span>
                    </div>
                  ))}

                  <div
                    className="flex items-center justify-between pt-2 mt-1 border-t"
                    style={{ borderColor: "rgba(255,255,255,0.15)" }}
                  >
                    <span className="text-xs text-white/60">종합 점수</span>
                    <span className="text-xl font-black text-white">83점</span>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* 하단 영역 */}
      <div className="pb-16 px-6 flex flex-col items-center gap-6">
        {/* Pill dot indicators */}
        <div className="flex gap-2 items-center">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToSlide(i)}
              className="rounded-full transition-all duration-400"
              style={{
                width: i === currentSlide ? 28 : 8,
                height: 8,
                background: i === currentSlide ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.3)",
              }}
            />
          ))}
        </div>

        {/* CTA 버튼 (마지막 슬라이드에서만) */}
        {currentSlide === slides.length - 1 && (
          <button
            onClick={handleStart}
            className="w-full max-w-xs h-14 text-base font-bold rounded-2xl active:scale-95 transition-transform"
            style={{
              background: "#ffffff",
              color: "#0D9488",
              boxShadow: "0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)",
            }}
          >
            지금 시작하기 🚀
          </button>
        )}
      </div>
    </div>
  );
}
