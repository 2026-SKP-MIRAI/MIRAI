"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JobCategorySelector } from "@/components/onboarding/JobCategorySelector";
import { TopBar } from "@/components/layout/TopBar";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (jobCategories: string[], careerStage: string) => {
    setLoading(true);
    try {
      // 선택 결과 localStorage 저장
      localStorage.setItem("jobCategories", JSON.stringify(jobCategories));
      localStorage.setItem("careerStage", careerStage);

      // 면접 시작 API 호출
      const res = await fetch("/api/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobCategories, careerStage }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.message ?? "면접 시작에 실패했습니다.");
        return;
      }

      const { sessionId, firstQuestion, questionsQueue } = await res.json();

      // 면접 상태를 sessionStorage에 저장
      sessionStorage.setItem("interview_init", JSON.stringify({
        sessionId,
        firstQuestion,
        questionsQueue,
        resumeText: `직군: ${jobCategories.join(", ")} / 취준 단계: ${careerStage}`,
      }));

      router.push(`/interview/${sessionId}`);
    } catch {
      alert("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <TopBar
        title="직군 선택"
        showBack
        backHref="/"
      />
      <div className="flex-1 overflow-y-auto pb-20 bg-white">
        <JobCategorySelector onSubmit={handleSubmit} loading={loading} />
      </div>
    </div>
  );
}
