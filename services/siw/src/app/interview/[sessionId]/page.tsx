"use client";
import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import InterviewChat from "@/components/InterviewChat";
import type { QuestionWithPersona, HistoryItem } from "@/lib/types";

export default function InterviewSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [currentQuestion, setCurrentQuestion] = useState<QuestionWithPersona | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [answer, setAnswer] = useState("");
  const [sessionComplete, setSessionComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const initialized = useRef(false);

  // 첫 질문은 sessionStorage에서 복원 (start 라우트가 저장)
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const stored = sessionStorage.getItem(`interview-first-${sessionId}`);
    if (stored) {
      setCurrentQuestion(JSON.parse(stored));
    }
  }, [sessionId]);

  async function handleSubmit() {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/interview/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, currentAnswer: answer }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }

      if (currentQuestion) {
        setHistory(prev => [...prev, {
          persona: currentQuestion.persona,
          personaLabel: currentQuestion.personaLabel,
          question: currentQuestion.question,
          answer,
          type: currentQuestion.type ?? "main",
        }]);
      }
      setAnswer("");
      setCurrentQuestion(data.nextQuestion);
      setSessionComplete(data.sessionComplete);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <InterviewChat
        currentQuestion={currentQuestion}
        history={history}
        sessionComplete={sessionComplete}
      />
      {!sessionComplete && (
        <div>
          <textarea
            data-testid="answer-input"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="답변을 입력하세요"
            rows={4}
          />
          <button
            data-testid="submit-answer"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "처리 중..." : "답변 제출"}
          </button>
          {error && <p>{error}</p>}
        </div>
      )}
      {sessionComplete && (
        <button onClick={() => router.push("/resume")}>다시 하기</button>
      )}
    </div>
  );
}
