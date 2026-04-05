import { LandingHero } from "@/components/landing-a/LandingHero";
import { LandingPainPoints } from "@/components/landing-a/LandingPainPoints";
import { LandingFeatures } from "@/components/landing-a/LandingFeatures";
import { LandingCTA } from "@/components/landing/LandingCTA";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "면접 준비, 이제 AI와 함께 | LWW",
  description: "AI 면접관과 1:1 실전 연습. 즉각적인 피드백으로 합격 가능성을 높이세요.",
  openGraph: {
    title: "면접 준비, 이제 AI와 함께 | LWW",
    description: "AI 면접관과 1:1 실전 연습. 즉각적인 피드백으로 합격 가능성을 높이세요.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "면접 준비, 이제 AI와 함께 | LWW",
    description: "AI 면접관과 1:1 실전 연습. 즉각적인 피드백으로 합격 가능성을 높이세요.",
  },
};

export default function LandingAPage() {
  return (
    <div className="w-full min-h-screen bg-[#0a0a0a] text-white">
      <LandingHero />
      <LandingPainPoints />
      <LandingFeatures />
      <section className="w-full bg-[#0a0a0a] py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4" style={{ fontFamily: "var(--font-sans)" }}>
            지금 바로 시작해보세요
          </h2>
          <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            AI 면접관과의 첫 연습은 무료입니다.
            <br />
            오늘부터 합격을 향한 여정을 시작하세요.
          </p>
          <LandingCTA text="지금 면접 시작하기" variant="primary" className="text-xl px-10 py-5" />
          <p className="mt-6 text-sm text-gray-600">신용카드 불필요 · 언제든지 취소 가능</p>
        </div>
      </section>
    </div>
  );
}
