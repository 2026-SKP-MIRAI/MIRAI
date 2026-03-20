"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { InterviewState, HistoryItem, PersonaType, QueueItem, ReportResponse } from "@/lib/types";

const PERSONA_LABELS: Record<PersonaType, string> = {
  hr: "HR 면접관",
  tech_lead: "기술 리드",
  executive: "임원 면접관",
};

const STORAGE_KEY = "interview_state";

function loadFromStorage(): Partial<InterviewState> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveToStorage(state: InterviewState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function clearStorage() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

interface UseInterviewOptions {
  sessionId: string;
}

interface UseInterviewReturn {
  state: InterviewState;
  sendAnswer: (answer: string) => Promise<void>;
  endInterview: () => Promise<ReportResponse | null>;
  resetError: () => void;
}

export function useInterview({ sessionId }: UseInterviewOptions): UseInterviewReturn {
  const [state, setState] = useState<InterviewState>(() => {
    // sessionStorage에서 초기 상태 복구 시도
    const stored = loadFromStorage();
    if (stored?.sessionId === sessionId) {
      return stored as InterviewState;
    }

    // 온보딩 페이지에서 저장한 interview_init 확인
    try {
      const initRaw = sessionStorage.getItem("interview_init");
      if (initRaw) {
        const init = JSON.parse(initRaw);
        if (init.sessionId === sessionId) {
          sessionStorage.removeItem("interview_init");
          return {
            sessionId: init.sessionId,
            resumeText: init.resumeText,
            currentQuestion: init.firstQuestion?.question ?? "",
            currentPersona: (init.firstQuestion?.persona ?? "hr") as PersonaType,
            history: [],
            questionsQueue: init.questionsQueue ?? [],
            questionIndex: 0,
            status: "answering",
          };
        }
      }
    } catch {}

    return {
      sessionId,
      resumeText: "",
      currentQuestion: "",
      currentPersona: "hr",
      history: [],
      questionsQueue: [],
      questionIndex: 0,
      status: "idle",
    };
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // 상태 변경 시마다 sessionStorage 동기화
  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  // 페이지 이탈 경고
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.status === "answering" || state.status === "submitting") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [state.status]);

  const sendAnswer = useCallback(async (answer: string) => {
    if (!state.currentQuestion || state.status === "submitting") return;

    const currentQuestion = state.currentQuestion;
    const currentPersona = state.currentPersona;

    setState(prev => ({ ...prev, status: "submitting" }));

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/interview/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText: state.resumeText,
          currentQuestion,
          currentAnswer: answer,
          currentPersona,
          history: state.history,
          questionsQueue: state.questionsQueue,
          sessionId: state.sessionId,
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "오류 발생" }));
        setState(prev => ({
          ...prev,
          status: "error",
        }));
        throw new Error(err.message);
      }

      const data = await res.json();

      // history 클라이언트 직접 누적 (엔진은 반환하지 않음)
      const newHistoryItem: HistoryItem = {
        question: currentQuestion,
        answer,
        persona: currentPersona,
        personaLabel: PERSONA_LABELS[currentPersona] ?? "AI 면접관",
      };

      setState(prev => ({
        ...prev,
        history: [...prev.history, newHistoryItem],
        questionsQueue: data.updatedQueue ?? [],
        currentQuestion: data.nextQuestion?.question ?? "",
        currentPersona: (data.nextQuestion?.persona ?? "hr") as PersonaType,
        questionIndex: prev.questionIndex + 1,
        status: data.sessionComplete ? "ending" : "answering",
      }));

    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setState(prev => ({ ...prev, status: "error" }));
      }
    }
  }, [state]);

  const endInterview = useCallback(async (): Promise<ReportResponse | null> => {
    setState(prev => ({ ...prev, status: "ending" }));

    try {
      const res = await fetch("/api/interview/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText: state.resumeText,
          history: state.history,
          sessionId: state.sessionId,
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!res.ok) {
        setState(prev => ({ ...prev, status: "error" }));
        return null;
      }

      const { report } = await res.json();
      setState(prev => ({ ...prev, status: "complete" }));
      clearStorage();

      // 리포트를 sessionStorage에 임시 저장 (리포트 페이지에서 읽음)
      sessionStorage.setItem(`report_${state.sessionId}`, JSON.stringify(report));

      // 면접 기록 localStorage 저장 (히스토리 페이지에서 읽음)
      try {
        const jobMatch = state.resumeText.match(/^직군:\s*(.+?)\s*\/\s*취준 단계:/);
        const jobCategories = jobMatch ? jobMatch[1].split(",").map((s: string) => s.trim()) : ["기타"];
        const record = { id: state.sessionId, date: new Date().toISOString(), jobCategories, score: report.totalScore };
        const existing: unknown[] = JSON.parse(localStorage.getItem("interview_history") ?? "[]");
        existing.unshift(record);
        localStorage.setItem("interview_history", JSON.stringify(existing.slice(0, 50)));
      } catch {}

      return report;
    } catch {
      setState(prev => ({ ...prev, status: "error" }));
      return null;
    }
  }, [state]);

  const resetError = useCallback(() => {
    setState(prev => ({ ...prev, status: "answering" }));
  }, []);

  return { state, sendAnswer, endInterview, resetError };
}
