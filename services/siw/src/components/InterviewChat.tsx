"use client";
import React from "react";
import type { QuestionWithPersona, HistoryItem, InterviewMode, PracticeFeedback } from "@/lib/types";

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
  // practice mode props (all optional for backwards compatibility)
  interviewMode?: InterviewMode;
  practiceFeedback?: PracticeFeedback | null;
  onRetryAnswer?: () => void;
  onNextQuestion?: () => void;
  isRetried?: boolean;
  practiceAnswer?: string;
  isNextLoading?: boolean;
}

export default function InterviewChat({ currentQuestion, history, sessionComplete, interviewMode, practiceFeedback, onRetryAnswer, onNextQuestion, isRetried, practiceAnswer, isNextLoading }: Props) {
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

      {/* 연습 모드 — 제출한 답변 버블 */}
      {interviewMode === "practice" && practiceFeedback && practiceAnswer && (
        <div className="ml-8 bg-white rounded-2xl p-4 border border-black/[0.08]">
          <p className="text-xs text-gray-400 mb-1 font-semibold">내 답변</p>
          <p className="text-sm text-[#4B5563] leading-relaxed whitespace-pre-wrap">{practiceAnswer}</p>
        </div>
      )}

      {/* 연습 모드 피드백 카드 */}
      {interviewMode === "practice" && practiceFeedback && (
        <div className="glass-card rounded-2xl p-5 space-y-4 border border-violet-200">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-violet-700">AI 피드백</p>
            <span data-testid="feedback-score" className="text-lg font-extrabold text-violet-700">{practiceFeedback.score}점</span>
          </div>

          {/* 점수 바 */}
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-violet-500 to-indigo-500 h-2 rounded-full transition-all"
              style={{ width: `${practiceFeedback.score}%` }}
            />
          </div>

          {/* 잘한 점 */}
          {practiceFeedback.feedback.good.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#10B981] mb-1">✅ 잘한 점</p>
              <ul data-testid="feedback-good" className="space-y-1">
                {practiceFeedback.feedback.good.map((g, i) => (
                  <li key={i} className="text-xs text-[#374151] leading-relaxed">• {g}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 개선점 */}
          {practiceFeedback.feedback.improve.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#F59E0B] mb-1">💡 개선점</p>
              <ul data-testid="feedback-improve" className="space-y-1">
                {practiceFeedback.feedback.improve.map((imp, i) => (
                  <li key={i} className="text-xs text-[#374151] leading-relaxed">• {imp}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 키워드 */}
          {practiceFeedback.keywords.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#6B7280] mb-1">🔑 핵심 키워드</p>
              <div data-testid="feedback-keywords" className="flex flex-wrap gap-1.5">
                {practiceFeedback.keywords.map((kw, i) => (
                  <span key={i} className="tag tag-purple text-xs">{kw}</span>
                ))}
              </div>
            </div>
          )}

          {/* 개선 답변 가이드 */}
          {practiceFeedback.improvedAnswerGuide && (
            <div>
              <p className="text-xs font-semibold text-[#6B7280] mb-1">📖 개선 답변 가이드</p>
              <p data-testid="feedback-guide" className="text-xs text-[#374151] leading-relaxed bg-gray-50 rounded-lg p-3">
                {practiceFeedback.improvedAnswerGuide}
              </p>
            </div>
          )}

          {/* 재답변 비교 (comparisonDelta) */}
          {practiceFeedback.comparisonDelta && (
            <div data-testid="feedback-delta" className="rounded-lg p-3 bg-indigo-50 border border-indigo-200">
              <p className="text-xs font-bold text-indigo-700 mb-1">
                점수 변화: {practiceFeedback.comparisonDelta.scoreDelta > 0 ? "+" : ""}{practiceFeedback.comparisonDelta.scoreDelta}점
              </p>
              <ul className="space-y-0.5">
                {practiceFeedback.comparisonDelta.improvements.map((imp, i) => (
                  <li key={i} className="text-xs text-indigo-600">• {imp}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-2 pt-1">
            {!isRetried && (
              <button
                data-testid="btn-retry"
                onClick={onRetryAnswer}
                className="flex-1 btn-outline rounded-xl py-2.5 text-sm"
              >
                다시 답변하기
              </button>
            )}
            <button
              data-testid="btn-next-question"
              onClick={onNextQuestion}
              disabled={isNextLoading}
              className="flex-1 btn-primary rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isNextLoading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />불러오는 중...</>
                : "다음 질문으로"
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
