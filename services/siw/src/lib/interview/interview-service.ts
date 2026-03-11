import { interviewRepository } from "./interview-repository";
import { resumeRepository } from "@/lib/resume-repository";
import type { PersonaType, QuestionWithPersona, InterviewAnswerResponse } from "@/lib/types";

const ENGINE_BASE_URL = process.env.ENGINE_BASE_URL ?? "http://localhost:8000";

const PERSONA_LABELS: Record<string, string> = {
  hr: "HR 담당자",
  tech_lead: "기술 리드",
  executive: "임원",
};

export const interviewService = {
  async start(resumeId: string, personas: PersonaType[]) {
    const resumeText = await resumeRepository.findById(resumeId);
    // 엔진 LLM output token limit 대응: resumeText 1200자로 제한
    const engineText = resumeText.slice(0, 1200);
    let resp: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      resp = await fetch(`${ENGINE_BASE_URL}/api/interview/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: engineText, personas, mode: "panel" }),
        signal: AbortSignal.timeout(30000),
      });
      if (resp.ok) break;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }
    if (!resp?.ok) throw new Error("engine_start_failed");

    const { firstQuestion, questionsQueue } = await resp.json();

    const sessionId = await interviewRepository.create({
      resumeText,
      currentQuestion: firstQuestion.question,
      currentPersona: firstQuestion.persona,
      currentQuestionType: firstQuestion.type ?? "main",
      questionsQueue,
    });

    return { sessionId, firstQuestion: firstQuestion as QuestionWithPersona };
  },

  async answer(sessionId: string, currentAnswer: string): Promise<InterviewAnswerResponse> {
    const session = await interviewRepository.findById(sessionId);

    // 이미 완료된 세션 — engine 호출 차단 (비용 절감)
    if (session.sessionComplete) throw new Error("session_complete");

    const historyForEngine = session.history.map(({ type: _type, ...rest }) => rest);

    let resp: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      resp = await fetch(`${ENGINE_BASE_URL}/api/interview/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText: session.resumeText,
          history: historyForEngine,
          questionsQueue: session.questionsQueue,
          currentQuestion: session.currentQuestion,
          currentPersona: session.currentPersona,
          currentAnswer,
        }),
        signal: AbortSignal.timeout(55000),
      });
      if (resp.ok) break;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }
    if (!resp?.ok) throw new Error("engine_answer_failed");
    const { nextQuestion, updatedQueue, sessionComplete } = await resp.json();

    const updatedHistory = [
      ...session.history,
      {
        persona: session.currentPersona as PersonaType,
        personaLabel: PERSONA_LABELS[session.currentPersona] ?? session.currentPersona,
        question: session.currentQuestion,
        answer: currentAnswer,
        type: session.currentQuestionType,
      },
    ];

    await interviewRepository.updateAfterAnswer(sessionId, {
      history: updatedHistory,
      questionsQueue: updatedQueue,
      currentQuestion: nextQuestion?.question ?? "",
      currentPersona: nextQuestion?.persona ?? "",
      currentQuestionType: nextQuestion?.type ?? "main",
      sessionComplete,
    });

    return { nextQuestion, updatedQueue, sessionComplete };
  },

  async followup(sessionId: string, question: string, answer: string, persona: PersonaType) {
    const { resumeText } = await interviewRepository.findById(sessionId);

    const resp = await fetch(`${ENGINE_BASE_URL}/api/interview/followup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer, persona, resumeText }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) throw new Error("engine_followup_failed");

    return resp.json();
  },
};
