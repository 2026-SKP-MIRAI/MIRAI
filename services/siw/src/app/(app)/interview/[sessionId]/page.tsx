"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import InterviewChat from "@/components/InterviewChat";
import type { QuestionWithPersona, HistoryItem, InterviewMode, PracticeFeedback } from "@/lib/types";

export default function InterviewSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [currentQuestion, setCurrentQuestion] = useState<QuestionWithPersona | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [answer, setAnswer] = useState("");
  const [sessionComplete, setSessionComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showExitModal, setShowExitModal] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [interviewMode, setInterviewMode] = useState<InterviewMode>("real");
  const [practiceFeedback, setPracticeFeedback] = useState<PracticeFeedback | null>(null);
  const [isRetried, setIsRetried] = useState(false);
  const [lastAnswer, setLastAnswer] = useState("");
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [fetchingFeedback, setFetchingFeedback] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const stored = sessionStorage.getItem(`interview-first-${sessionId}`);
    if (stored) {
      try { setCurrentQuestion(JSON.parse(stored)); } catch { /* 손상된 캐시는 무시 */ }
    }
    const storedMode = sessionStorage.getItem(`interview-mode-${sessionId}`);
    if (storedMode === "practice" || storedMode === "real") {
      setInterviewMode(storedMode);
    }
  }, [sessionId]);

  async function handleSubmit() {
    if (!answer.trim() || submitting || fetchingFeedback) return;

    if (interviewMode === "real") {
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
    } else {
      // practice mode: get feedback first, don't advance question
      setFetchingFeedback(true);
      setError("");
      const currentAnswerText = answer;
      const prevAnswer = isRetried ? lastAnswer : undefined;
      try {
        const body: Record<string, string> = {
          question: currentQuestion?.question ?? "",
          answer: currentAnswerText,
        };
        if (prevAnswer) body.previousAnswer = prevAnswer;

        const res = await fetch("/api/practice/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.message); return; }

        if (!isRetried) {
          setLastAnswer(currentAnswerText);
        }
        setAnswer("");
        setPracticeAnswer(currentAnswerText);
        setPracticeFeedback(data);
      } catch {
        setError("피드백 생성에 실패했습니다.");
      } finally {
        setFetchingFeedback(false);
      }
    }
  }

  function handleRetry() {
    setIsRetried(true);
  }

  async function handleNextQuestion() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/interview/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, currentAnswer: lastAnswer }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      if (currentQuestion) {
        setHistory(prev => [...prev, {
          persona: currentQuestion!.persona,
          personaLabel: currentQuestion!.personaLabel,
          question: currentQuestion!.question,
          answer: lastAnswer,
          type: currentQuestion!.type ?? "main",
        }]);
      }
      setPracticeFeedback(null);
      setIsRetried(false);
      setLastAnswer("");
      setPracticeAnswer("");
      setCurrentQuestion(data.nextQuestion);
      setSessionComplete(data.sessionComplete);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExit() {
    setExiting(true);
    try {
      await fetch(`/api/interview/${sessionId}/complete`, { method: "PATCH" });
      if (history.length >= 5) {
        router.push(`/interview/${sessionId}/report`);
      } else {
        router.push("/dashboard");
      }
    } finally {
      setExiting(false);
      setShowExitModal(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col">
      <header className="glass-panel sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold gradient-text">MirAI</Link>
          <div className="flex items-center gap-3">
            <span className="tag tag-purple">면접 진행 중</span>
            <button
              onClick={() => setShowExitModal(true)}
              className="border border-gray-200 text-gray-600 rounded-full px-4 py-1.5 text-sm hover:bg-gray-50 active:scale-95 transition-all"
            >
              면접 종료
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 flex-1 flex flex-col gap-4 w-full">
        <div className="flex-1">
          <InterviewChat
            currentQuestion={currentQuestion}
            history={history}
            sessionComplete={sessionComplete}
            interviewMode={interviewMode}
            practiceFeedback={practiceFeedback}
            onRetryAnswer={handleRetry}
            onNextQuestion={handleNextQuestion}
            isRetried={isRetried}
            practiceAnswer={practiceAnswer}
            isNextLoading={submitting}
          />
        </div>

        {!sessionComplete && (!practiceFeedback || isRetried) && (
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
              disabled={submitting || fetchingFeedback || !answer.trim()}
              className="btn-primary rounded-xl px-5 py-3 w-full mt-3 flex items-center justify-center gap-2"
            >
              {fetchingFeedback
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />피드백 생성 중...</>
                : submitting
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
            <button onClick={() => router.push("/interview/new")} className="btn-outline rounded-xl px-6 py-3 w-full">
              다시 하기
            </button>
          </div>
        )}
      </main>

      {/* 종료 모달 */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">면접을 종료하시겠어요?</h3>
            <p className="text-sm text-gray-500 mb-6 leading-[1.7]">
              {history.length >= 5
                ? "충분한 답변이 있어 리포트를 생성할 수 있습니다."
                : `아직 답변이 ${history.length}개입니다. 리포트는 5개 이상 답변이 필요합니다.`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowExitModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full py-2.5 font-semibold text-sm transition-all active:scale-95"
              >
                계속하기
              </button>
              <button
                onClick={handleExit}
                disabled={exiting}
                className="flex-1 text-white rounded-full py-2.5 font-semibold text-sm shadow-[0_4px_14px_rgba(124,58,237,0.35)] active:scale-95 transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
              >
                {exiting ? "종료 중..." : "종료하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
