"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
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

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const stored = sessionStorage.getItem(`interview-first-${sessionId}`);
    if (stored) setCurrentQuestion(JSON.parse(stored));
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
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col">
      <header className="glass-panel sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold gradient-text">MirAI</Link>
          <span className="tag tag-purple">면접 진행 중</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 flex-1 flex flex-col gap-4 w-full">
        <div className="flex-1">
          <InterviewChat
            currentQuestion={currentQuestion}
            history={history}
            sessionComplete={sessionComplete}
          />
        </div>

        {!sessionComplete && (
          <div className="glass-card rounded-2xl p-4 sticky bottom-4">
            <textarea
              data-testid="answer-input"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="답변을 입력하세요"
              rows={4}
              className="input-dark w-full rounded-xl px-4 py-3 text-sm resize-none"
            />
            {error && <p className="text-sm text-[#EF4444] mt-2">{error}</p>}
            <button
              data-testid="submit-answer"
              onClick={handleSubmit}
              disabled={submitting || !answer.trim()}
              className="btn-primary rounded-xl px-5 py-3 w-full mt-3 flex items-center justify-center gap-2"
            >
              {submitting
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />처리 중...</>
                : "답변 제출"
              }
            </button>
          </div>
        )}

        {sessionComplete && (
          <div className="glass-card rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[#1F2937] mb-2">면접이 완료됐습니다</h3>
            <button
              onClick={() => router.push(`/interview/${sessionId}/report`)}
              className="btn-primary rounded-xl px-6 py-3 mb-3 w-full"
            >
              리포트 보기
            </button>
            <button onClick={() => router.push("/resume")} className="btn-outline rounded-xl px-6 py-3 w-full">
              다시 하기
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
