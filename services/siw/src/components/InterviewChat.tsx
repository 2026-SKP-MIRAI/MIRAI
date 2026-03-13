"use client";
import React from "react";
import type { QuestionWithPersona, HistoryItem } from "@/lib/types";

const PERSONA_LABELS: Record<string, string> = {
  hr: "HR 담당자",
  tech_lead: "기술 리드",
  executive: "임원",
};

// 모든 페르소나 통일: 옅은 보라 계열 배경 + 테두리
const PERSONA_STYLE: Record<string, { bg: string; border: string; nameColor: string }> = {
  hr:        { bg: "bg-white", border: "border-purple-200", nameColor: "font-bold text-[#7C3AED]" },
  tech_lead: { bg: "bg-white", border: "border-purple-200", nameColor: "font-bold text-[#7C3AED]" },
  executive: { bg: "bg-white", border: "border-purple-200", nameColor: "font-bold text-[#7C3AED]" },
};

interface Props {
  currentQuestion: QuestionWithPersona | null;
  history: HistoryItem[];
  sessionComplete: boolean;
}

export default function InterviewChat({ currentQuestion, history, sessionComplete }: Props) {
  return (
    <div className="space-y-6">
      {history.map((item, i) => {
        const style = PERSONA_STYLE[item.persona] ?? PERSONA_STYLE.hr;
        return (
          <div key={i} className="space-y-2">
            <div
              data-testid="chat-message"
              className={`rounded-2xl p-4 border ${style.bg} ${style.border}`}
            >
              <p
                data-testid="persona-label"
                className={`${style.nameColor} mb-2 text-sm`}
              >
                {PERSONA_LABELS[item.persona] ?? item.persona}
              </p>
              <p className="text-sm text-[#1F2937] leading-relaxed">{item.question}</p>
            </div>
            <div
              data-testid="user-answer"
              className="ml-8 bg-white rounded-2xl p-4 border border-black/8"
            >
              <p className="text-sm text-[#4B5563] leading-relaxed">{item.answer}</p>
            </div>
          </div>
        );
      })}

      {!sessionComplete && currentQuestion && (() => {
        const style = PERSONA_STYLE[currentQuestion.persona] ?? PERSONA_STYLE.hr;
        return (
          <div
            data-testid="chat-message"
            className={`rounded-2xl p-4 border ${style.bg} ${style.border}`}
          >
            <p
              data-testid="persona-label"
              className={`${style.nameColor} mb-2 text-sm`}
            >
              {PERSONA_LABELS[currentQuestion.persona] ?? currentQuestion.persona}
            </p>
            <p className="text-sm text-[#1F2937] leading-relaxed">{currentQuestion.question}</p>
          </div>
        );
      })()}

      {sessionComplete && (
        <div data-testid="session-complete" className="text-center py-4">
          <p className="text-sm text-[#9CA3AF]">면접이 완료되었습니다</p>
        </div>
      )}
    </div>
  );
}
