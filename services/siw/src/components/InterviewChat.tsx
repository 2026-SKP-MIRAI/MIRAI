"use client";
import React from "react";
import type { QuestionWithPersona, HistoryItem } from "@/lib/types";

const PERSONA_LABELS: Record<string, string> = {
  hr: "HR 담당자",
  tech_lead: "기술 리드",
  executive: "임원",
};

interface Props {
  currentQuestion: QuestionWithPersona | null;
  history: HistoryItem[];
  sessionComplete: boolean;
}

export default function InterviewChat({ currentQuestion, history, sessionComplete }: Props) {
  return (
    <div>
      {history.map((item, i) => (
        <div key={i}>
          <div data-testid="chat-message">
            <span data-testid="persona-label">
              {PERSONA_LABELS[item.persona] ?? item.persona}
            </span>
            <p>{item.question}</p>
          </div>
          <div data-testid="user-answer">
            <p>{item.answer}</p>
          </div>
        </div>
      ))}
      {!sessionComplete && currentQuestion && (
        <div data-testid="chat-message">
          <span data-testid="persona-label">
            {PERSONA_LABELS[currentQuestion.persona] ?? currentQuestion.persona}
          </span>
          <p>{currentQuestion.question}</p>
        </div>
      )}
      {sessionComplete && (
        <div data-testid="session-complete">
          <p>면접이 완료되었습니다</p>
        </div>
      )}
    </div>
  );
}
