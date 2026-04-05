import { LandingHero } from "@/components/landing-b/LandingHero";
import { LandingPainPoints } from "@/components/landing-b/LandingPainPoints";
import { LandingFeatures } from "@/components/landing-b/LandingFeatures";
import { LandingCTA } from "@/components/landing/LandingCTA";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI 면접 코치 | LWW",
  description: "혼자 준비하는 면접은 이제 그만. AI 면접 코치와 함께 합격을 준비하세요.",
  openGraph: {
    title: "AI 면접 코치 | LWW",
    description: "혼자 준비하는 면접은 이제 그만. AI 면접 코치와 함께 합격을 준비하세요.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI 면접 코치 | LWW",
    description: "혼자 준비하는 면접은 이제 그만. AI 면접 코치와 함께 합격을 준비하세요.",
  },
};

export default function LandingBPage() {
  return (
    <div className="w-full bg-white text-gray-900">
      <LandingHero />
      <LandingPainPoints />
      <LandingFeatures />
      <section className="w-full bg-gradient-to-br from-[#0D9488] to-[#0f766e] px-6 py-16 md:py-24 lg:py-28 text-center">
        <div className="max-w-2xl mx-auto flex flex-col gap-6 items-center">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white">
            지금 바로 시작해보세요
          </h2>
          <p className="text-teal-100 text-base md:text-lg">
            AI 면접관과의 첫 연습은 무료입니다.<br />
            오늘부터 합격을 향한 여정을 시작하세요.
          </p>
          <LandingCTA
            text="무료로 시작하기"
            variant="outline"
            className="border-white text-white hover:bg-white hover:text-[#0D9488] text-lg px-10 py-4"
          />
          <p className="text-teal-100/70 text-sm">신용카드 불필요 · 언제든지 취소 가능</p>
        </div>
      </section>
    </div>
  );
}
