"use client";
import React, { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import InterviewChat from "@/components/InterviewChat";
import type { QuestionWithPersona, HistoryItem, InterviewMode, PracticeFeedback } from "@/lib/types";
import { parseSSEStream } from "@/lib/sse-utils";

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
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [fetchingFeedback, setFetchingFeedback] = useState(false);
  const [retryInputVisible, setRetryInputVisible] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingPersona, setStreamingPersona] = useState<{ persona: string; personaLabel: string } | null>(null);
  const [pendingAnswer, setPendingAnswer] = useState("");
  const [sessionInterrupted, setSessionInterrupted] = useState(false);
  const [lastSubmittedAnswer, setLastSubmittedAnswer] = useState("");
  const initialized = useRef(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, currentQuestion, streamingText]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const stored = sessionStorage.getItem(`interview-first-${sessionId}`);
    if (stored) {
      try { setCurrentQuestion(JSON.parse(stored)); } catch { setSessionInterrupted(true); }
    } else {
      // sessionStorage miss — 브라우저 종료 후 재접속
      setSessionInterrupted(true);
    }
    const storedMode = sessionStorage.getItem(`interview-mode-${sessionId}`);
    if (storedMode === "practice" || storedMode === "real") {
      setInterviewMode(storedMode);
    }
  }, [sessionId]);

  async function consumeAnswerStream(body: ReadableStream<Uint8Array>) {
    setStreamingText("");
    let donePayload: { nextQuestion: QuestionWithPersona | null; sessionComplete: boolean } | null = null;
    try {
      for await (const event of parseSSEStream(body)) {
        if (event.type === "token") {
          flushSync(() => setStreamingText(prev => prev + event.text));
        } else if (event.type === "meta") {
          setStreamingPersona({ persona: event.persona, personaLabel: event.personaLabel });
        } else if (event.type === "done") {
          donePayload = event as { type: "done"; nextQuestion: QuestionWithPersona | null; updatedQueue: unknown[]; sessionComplete: boolean };
        } else if (event.type === "error") {
          setStreamingText("");
          setStreamingPersona(null);
          setPendingAnswer("");
          setError(event.message);
          throw new Error(event.message);
        }
      }
    } catch (err) {
      setStreamingText("");
      setStreamingPersona(null);
      if (!donePayload) {
        setError("연결이 끊겼습니다. 마지막 답변을 다시 제출해주세요.");
        throw err;
      }
    }
    setStreamingText("");
    setStreamingPersona(null);
    // offline 모드 등 스트림이 에러 없이 조기 종료된 경우 (done 이벤트 미수신)
    if (!donePayload) {
      setError("연결이 끊겼습니다. 마지막 답변을 다시 제출해주세요.");
      throw new Error("stream terminated without done event");
    }
    return donePayload;
  }

  async function handleSubmit() {
    if (!answer.trim() || submitting || fetchingFeedback) return;

    if (interviewMode === "real") {
      setSubmitting(true);
      setError("");
      const submittedAnswer = answer;
      setLastSubmittedAnswer(submittedAnswer);
      setPendingAnswer(submittedAnswer);
      try {
        const res = await fetch("/api/interview/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, currentAnswer: submittedAnswer }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ message: "오류 발생" }));
          setError(data.message);
          setPendingAnswer("");
          return;
        }
        if (!res.body) { setError("스트림 응답이 없습니다."); setPendingAnswer(""); return; }

        const doneEvent = await consumeAnswerStream(res.body);

        if (currentQuestion) {
          setHistory(prev => [...prev, {
            persona: currentQuestion.persona,
            personaLabel: currentQuestion.personaLabel,
            question: currentQuestion.question,
            answer: submittedAnswer,
            type: currentQuestion.type ?? "main",
          }]);
        }
        setAnswer("");
        setPendingAnswer("");
        setCurrentQuestion(doneEvent?.nextQuestion ?? null);
        setSessionComplete(doneEvent?.sessionComplete ?? false);
      } catch (err) {
        setPendingAnswer("");
        // fetch 자체 실패 (offline 등) — consumeAnswerStream은 이미 setError 처리함
        if (err instanceof TypeError) {
          setError("연결이 끊겼습니다. 마지막 답변을 다시 제출해주세요.");
        }
      } finally {
        setSubmitting(false);
      }
    } else {
      // practice mode: get feedback first, don't advance question
      setFetchingFeedback(true);
      setError("");
      const currentAnswerText = answer;
      const prevAnswer = isRetried ? lastAnswer : undefined;
      setPendingAnswer(currentAnswerText);
      try {
        const body: Record<string, unknown> = {
          question: currentQuestion?.question ?? "",
          answer: currentAnswerText,
        };
        if (prevAnswer) body.previousAnswer = prevAnswer;
        if (isRetried && lastScore !== null) body.previousScore = lastScore;

        const res = await fetch("/api/practice/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.message); setPendingAnswer(""); return; }

        if (!isRetried) {
          setLastAnswer(currentAnswerText);
          setLastScore(data.score);
        } else {
          setLastAnswer(currentAnswerText);  // 재답변 시에도 lastAnswer 업데이트 (다음질문으로 전송할 답변)
          setRetryInputVisible(false);
        }
        setAnswer("");
        setPendingAnswer("");
        setPracticeAnswer(currentAnswerText);
        setPracticeFeedback(data);
      } catch {
        setError("피드백 생성에 실패했습니다.");
        setPendingAnswer("");
      } finally {
        setFetchingFeedback(false);
      }
    }
  }

  function handleRetry() {
    setIsRetried(true);
    setRetryInputVisible(true);
  }

  async function handleNextQuestion() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setPracticeFeedback(null);
    setRetryInputVisible(false);
    setPendingAnswer(lastAnswer);
    try {
      const res = await fetch("/api/interview/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, currentAnswer: lastAnswer }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "오류 발생" }));
        setError(data.message);
        setPendingAnswer("");
        return;
      }
      const doneEvent = res.body ? await consumeAnswerStream(res.body) : null;
      if (currentQuestion) {
        setHistory(prev => [...prev, {
          persona: currentQuestion!.persona,
          personaLabel: currentQuestion!.personaLabel,
          question: currentQuestion!.question,
          answer: lastAnswer,
          type: currentQuestion!.type ?? "main",
        }]);
      }
      setPendingAnswer("");
      setIsRetried(false);
      setLastAnswer("");
      setLastScore(null);
      setPracticeAnswer("");
      setCurrentQuestion(doneEvent?.nextQuestion ?? null);
      setSessionComplete(doneEvent?.sessionComplete ?? false);
    } catch {
      setPendingAnswer("");
      setError("다음 질문을 불러오지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetryLastAnswer() {
    if (!lastSubmittedAnswer.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    setPendingAnswer(lastSubmittedAnswer);
    try {
      const res = await fetch("/api/interview/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, currentAnswer: lastSubmittedAnswer }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "오류 발생" }));
        setError(data.message);
        setPendingAnswer("");
        return;
      }
      if (!res.body) { setError("스트림 응답이 없습니다."); setPendingAnswer(""); return; }

      const doneEvent = await consumeAnswerStream(res.body);

      if (currentQuestion) {
        setHistory(prev => [...prev, {
          persona: currentQuestion.persona,
          personaLabel: currentQuestion.personaLabel,
          question: currentQuestion.question,
          answer: lastSubmittedAnswer,
          type: currentQuestion.type ?? "main",
        }]);
      }
      setAnswer("");
      setPendingAnswer("");
      setLastSubmittedAnswer("");
      setCurrentQuestion(doneEvent?.nextQuestion ?? null);
      setSessionComplete(doneEvent?.sessionComplete ?? false);
    } catch {
      setPendingAnswer("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExit() {
    setExiting(true);
    try {
      await fetch(`/api/interview/${sessionId}/complete`, { method: "PATCH" });
      if (interviewMode === "practice") {
        router.push("/interview/new");
      } else if (history.length >= 5) {
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
        {/* 세션 중단 안내 */}
        {sessionInterrupted && !currentQuestion && !sessionComplete && (
          <div data-testid="session-interrupted" className="glass-card rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[#1F2937] mb-2">면접이 중단되었습니다</h3>
            <p className="text-sm text-[#9CA3AF] mb-6">브라우저가 종료되어 세션 정보가 초기화되었습니다.</p>
            <button
              data-testid="btn-restart"
              onClick={() => router.push("/interview/new")}
              className="btn-primary rounded-xl px-6 py-3 w-full"
            >
              처음부터 다시 시작
            </button>
          </div>
        )}

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
            streamingText={streamingText}
            streamingPersona={streamingPersona}
            pendingAnswer={pendingAnswer}
            isFetchingFeedback={fetchingFeedback}
          />
          <div ref={chatBottomRef} />
        </div>

        {!sessionComplete && (!practiceFeedback || retryInputVisible) && (
          <div className="glass-card rounded-2xl p-4 sticky bottom-4">
            <textarea
              data-testid="answer-input"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="답변을 입력하세요"
              rows={4}
              className="input-dark w-full rounded-xl px-4 py-3 text-sm resize-none"
            />
            <div className="flex items-center justify-between mt-1.5">
              <div>
                {answer.length > 5000 && (
                  <p data-testid="char-warning" className="text-xs text-amber-600 font-medium">5000자를 초과한 내용은 저장되지 않습니다</p>
                )}
              </div>
              <p data-testid="char-count" className={`text-xs ${answer.length > 5000 ? "text-amber-600 font-medium" : "text-gray-400"}`}>
                {answer.length} / 5000
              </p>
            </div>
            {error && (
              <div className="mt-2">
                <p className="text-sm text-[#EF4444]">{error}</p>
                {error.includes("연결이 끊겼습니다") && lastSubmittedAnswer && (
                  <button
                    data-testid="btn-retry-answer"
                    onClick={handleRetryLastAnswer}
                    disabled={submitting}
                    className="btn-outline rounded-xl px-4 py-2 mt-2 text-sm"
                  >
                    마지막 답변 다시 제출
                  </button>
                )}
              </div>
            )}
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

        {sessionComplete && interviewMode === "practice" && (
          <div className="glass-card rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[#1F2937] mb-2">연습이 완료됐습니다</h3>
            <button onClick={() => router.push("/interview/new")} className="btn-outline rounded-xl px-6 py-3 w-full">
              다시 하기
            </button>
          </div>
        )}

        {sessionComplete && interviewMode === "real" && (
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
              {interviewMode === "practice"
                ? `현재 ${history.length}개의 답변이 있습니다. 종료하시겠습니까?`
                : history.length >= 5
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
