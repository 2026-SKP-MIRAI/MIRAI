import { interviewRepository } from "./interview-repository";
import { resumeRepository } from "@/lib/resume-repository";
import { EngineStartResponseSchema, EngineAnswerResponseSchema } from "./schemas";
import type { PersonaType, InterviewAnswerResponse } from "@/lib/types";

const ENGINE_BASE_URL = process.env.ENGINE_BASE_URL ?? "http://localhost:8000";

const PERSONA_LABELS: Record<string, string> = {
  hr: "HR 담당자",
  tech_lead: "기술 리드",
  executive: "임원",
};

export const interviewService = {
  async start(resumeId: string, personas: PersonaType[], userId?: string | null) {
    const resumeText = await resumeRepository.findById(resumeId);
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

    const parsed = EngineStartResponseSchema.parse(await resp.json());

    const sessionId = await interviewRepository.create({
      resumeText,
      currentQuestion: parsed.firstQuestion.question,
      currentPersona: parsed.firstQuestion.persona,
      currentQuestionType: parsed.firstQuestion.type ?? "main",
      questionsQueue: parsed.questionsQueue,
      userId: userId ?? null,
    });

    return { sessionId, firstQuestion: parsed.firstQuestion };
  },

  async answer(sessionId: string, currentAnswer: string): Promise<InterviewAnswerResponse> {
    const session = await interviewRepository.findById(sessionId);
    if (session.sessionComplete) throw new Error("session_complete");

    let engineResult: ReturnType<typeof EngineAnswerResponseSchema.parse>;

    if (session.engineResultCache) {
      engineResult = EngineAnswerResponseSchema.parse(session.engineResultCache);
    } else {
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

      engineResult = EngineAnswerResponseSchema.parse(await resp.json());
      await interviewRepository.saveEngineResult(sessionId, engineResult);
    }

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
      questionsQueue: engineResult.updatedQueue,
      currentQuestion: engineResult.nextQuestion?.question ?? "",
      currentPersona: engineResult.nextQuestion?.persona ?? "",
      currentQuestionType: engineResult.nextQuestion?.type ?? "main",
      sessionComplete: engineResult.sessionComplete,
      engineResultCache: null,
    });

    return {
      nextQuestion: engineResult.nextQuestion,
      updatedQueue: engineResult.updatedQueue,
      sessionComplete: engineResult.sessionComplete,
    };
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
