"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const JOB_CATEGORIES = [
  "IT/개발", "마케팅", "PM/기획", "금융",
  "컨설팅", "HR", "디자인", "영업",
];

const JOB_EMOJIS: Record<string, string> = {
  "IT/개발": "💻",
  "마케팅": "📢",
  "PM/기획": "📋",
  "금융": "💰",
  "컨설팅": "🤝",
  "HR": "👥",
  "디자인": "🎨",
  "영업": "🎯",
};

const CAREER_STAGES = [
  { value: "서류 준비 중", label: "서류 준비 중", icon: "📝", desc: "서류 전형을 준비하고 있어요" },
  { value: "면접 준비 중", label: "면접 준비 중", icon: "🎯", desc: "면접이 코앞으로 다가왔어요" },
  { value: "최종합격 대기", label: "최종합격 대기", icon: "⏳", desc: "결과를 기다리는 중이에요" },
];

interface JobCategorySelectorProps {
  onSubmit: (jobCategories: string[], careerStage: string) => void;
  loading?: boolean;
}

export function JobCategorySelector({ onSubmit, loading }: JobCategorySelectorProps) {
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [selectedStage, setSelectedStage] = useState<string>("");

  const toggleJob = (job: string) => {
    setSelectedJobs(prev => {
      if (prev.includes(job)) return prev.filter(j => j !== job);
      if (prev.length >= 3) return prev;
      return [...prev, job];
    });
  };

  const canSubmit = selectedJobs.length > 0 && selectedStage !== "";

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(selectedJobs, selectedStage);
  };

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Decorative teal gradient strip */}
      <div
        className="w-full h-1.5 flex-shrink-0"
        style={{ background: "linear-gradient(to right, #0D9488, #164E63)" }}
      />

      {/* Progress indicator */}
      <div className="px-5 pt-5 pb-2 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: "#0D9488" }}
          >
            1
          </div>
          <div className="h-0.5 w-12" style={{ background: "#0D9488", opacity: 0.3 }} />
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: "#E5E7EB", color: "#9CA3AF" }}
          >
            2
          </div>
        </div>
        <span className="text-xs text-gray-400 ml-1">프로필 설정</span>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4 pb-8">
        {/* 직군 선택 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
          {/* Section header with step indicator */}
          <div className="flex items-start gap-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0 mt-0.5"
              style={{ background: "linear-gradient(135deg, #0D9488, #0F766E)" }}
            >
              ①
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-tight">
                어떤 직군에 지원하나요?
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                최대 3개까지 선택할 수 있어요
              </p>
            </div>
          </div>

          {/* Job chips */}
          <div className="flex flex-wrap gap-2">
            {JOB_CATEGORIES.map(job => {
              const isSelected = selectedJobs.includes(job);
              const isDisabled = !isSelected && selectedJobs.length >= 3;
              return (
                <button
                  key={job}
                  onClick={() => toggleJob(job)}
                  disabled={isDisabled}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-sm font-semibold border-2 transition-all duration-200 min-h-[44px]",
                    isSelected
                      ? "text-white scale-105"
                      : "bg-white text-gray-500 border-gray-200",
                    isDisabled && "opacity-30 cursor-not-allowed"
                  )}
                  style={
                    isSelected
                      ? {
                          background: "linear-gradient(135deg, #0D9488, #0F766E)",
                          borderColor: "#0D9488",
                          boxShadow: "0 4px 12px rgba(13,148,136,0.35)",
                        }
                      : undefined
                  }
                >
                  <span>{JOB_EMOJIS[job]}</span>
                  <span>{job}</span>
                </button>
              );
            })}
          </div>

          {/* Selection count feedback */}
          <div className="h-5">
            {selectedJobs.length > 0 && (
              <p className="text-xs font-semibold" style={{ color: "#0D9488" }}>
                {selectedJobs.length}개 선택됨
                {selectedJobs.length < 3 ? ` · 최대 ${3 - selectedJobs.length}개 더 선택 가능` : " · 최대 선택 완료!"}
              </p>
            )}
          </div>
        </div>

        {/* 취준 단계 선택 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-start gap-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0 mt-0.5"
              style={{ background: "linear-gradient(135deg, #0D9488, #0F766E)" }}
            >
              ②
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-tight">
                현재 취준 단계가 어떻게 되나요?
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                맞춤 면접 준비를 도와드릴게요
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {CAREER_STAGES.map(stage => {
              const isSelected = selectedStage === stage.value;
              return (
                <button
                  key={stage.value}
                  onClick={() => setSelectedStage(stage.value)}
                  className="flex items-center gap-4 p-4 rounded-2xl text-left transition-all duration-200 active:scale-[0.98] relative overflow-hidden"
                  style={
                    isSelected
                      ? {
                          background: "rgba(13,148,136,0.06)",
                          border: "2px solid #0D9488",
                          boxShadow: "0 4px 16px rgba(13,148,136,0.14)",
                        }
                      : {
                          background: "#ffffff",
                          border: "2px solid #F3F4F6",
                        }
                  }
                >
                  {/* Left accent bar */}
                  {isSelected && (
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                      style={{ background: "linear-gradient(to bottom, #0D9488, #0F766E)" }}
                    />
                  )}

                  {/* Icon */}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 transition-all duration-200"
                    style={
                      isSelected
                        ? { background: "rgba(13,148,136,0.12)" }
                        : { background: "#F9FAFB" }
                    }
                  >
                    {stage.icon}
                  </div>

                  {/* Label + desc */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-bold leading-tight"
                      style={{ color: isSelected ? "#0D9488" : "#374151" }}
                    >
                      {stage.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{stage.desc}</p>
                  </div>

                  {/* Check circle */}
                  <div
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200"
                    style={
                      isSelected
                        ? { background: "#0D9488", borderColor: "#0D9488" }
                        : { background: "transparent", borderColor: "#D1D5DB" }
                    }
                  >
                    {isSelected && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* CTA 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || loading}
          className="w-full h-14 text-base font-bold rounded-2xl transition-all duration-200 flex items-center justify-center gap-2"
          style={
            canSubmit && !loading
              ? {
                  background: "linear-gradient(135deg, #0D9488, #0F766E)",
                  color: "#ffffff",
                  boxShadow: "0 8px 24px rgba(13,148,136,0.35)",
                }
              : {
                  background: "#F3F4F6",
                  color: "#9CA3AF",
                  cursor: "not-allowed",
                }
          }
        >
          {loading ? (
            <>
              <span
                className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin flex-shrink-0"
              />
              <span>면접 시작하는 중...</span>
            </>
          ) : canSubmit ? (
            <span>면접 시작하기 →</span>
          ) : (
            <span>직군과 단계를 선택해주세요</span>
          )}
        </button>

        {/* 하단 팁 */}
        <div
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: "rgba(13,148,136,0.06)", border: "1px solid rgba(13,148,136,0.12)" }}
        >
          <span className="text-xl flex-shrink-0">💡</span>
          <div>
            <p className="text-xs font-bold" style={{ color: "#0D9488" }}>면접 준비 팁</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              직군을 선택하면 해당 분야에 최적화된 면접 질문을 받을 수 있어요. 여러 직군을 선택하면 더 폭넓은 준비가 가능해요!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
