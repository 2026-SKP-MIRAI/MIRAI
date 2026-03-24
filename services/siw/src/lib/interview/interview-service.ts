import { interviewRepository } from "./interview-repository";
import { resumeRepository } from "@/lib/resume-repository";
import { EngineStartResponseSchema, EngineAnswerResponseSchema } from "./schemas";
import type { PersonaType, InterviewAnswerResponse } from "@/lib/types";
import { withEventLogging } from "@/lib/observability/event-logger";

const ENGINE_BASE_URL = process.env.ENGINE_BASE_URL ?? "http://localhost:8000";

const PERSONA_LABELS: Record<string, string> = {
  hr: "HR 담당자",
  tech_lead: "기술 리드",
  executive: "임원",
};

export const interviewService = {
  async start(resumeId: string, personas: PersonaType[], userId?: string | null) {
    let resume;
    try {
      resume = await resumeRepository.findById(resumeId);
    } catch (err) {
      console.error("[interviewService.start] resume not found:", resumeId, err);
      throw new Error("resume_not_found");
    }
    const resumeText = resume.resumeText;
    if (!resumeText || resumeText.trim().length === 0) {
      console.error("[interviewService.start] resumeText is empty for resumeId:", resumeId);
      throw new Error("resume_text_empty");
    }
    const engineText = resumeText.slice(0, 1200);
    const parsed = await withEventLogging('interview_start', null, async (meta) => {
      let r: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        meta.retry_count = attempt;
        try {
          r = await fetch(`${ENGINE_BASE_URL}/api/interview/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resumeText: engineText, personas, mode: "panel" }),
            signal: AbortSignal.timeout(30000),
          });
        } catch (fetchErr) {
          console.error(`[interviewService.start] fetch attempt ${attempt + 1} failed:`, fetchErr);
          if (attempt < 2) await new Promise(res => setTimeout(res, 1000));
          continue;
        }
        if (r.ok) break;
        console.error(`[interviewService.start] engine returned ${r.status} on attempt ${attempt + 1}`);
        if (attempt < 2) await new Promise(res => setTimeout(res, 1000));
      }
      if (!r?.ok) {
        console.error(`[interviewService.start] engine_start_failed after retries. ENGINE_BASE_URL=${ENGINE_BASE_URL}`);
        throw new Error("engine_start_failed");
      }
      const d = await r.json();
      if (d.usage) meta.usage = d.usage;
      return EngineStartResponseSchema.parse(d);
    });

    const sessionId = await interviewRepository.create({
      resumeText,
      currentQuestion: parsed.firstQuestion.question,
      currentPersona: parsed.firstQuestion.persona,
      currentQuestionType: parsed.firstQuestion.type ?? "main",
      questionsQueue: parsed.questionsQueue,
      userId: userId ?? null,
      resumeId,
    });

    return { sessionId, firstQuestion: parsed.firstQuestion };
  },

  /**
   * SSE 스트리밍 answer: 엔진 SSE 스트림 Response를 반환.
   * engineResultCache 존재 시: 스트리밍 없이 done 이벤트만 담은 가짜 스트림 반환.
   * 재시도: SSE 연결 실패(HTTP 비정상/네트워크)만 재시도, 스트림 파싱 오류는 재시도 안 함.
   */
  async answerStream(sessionId: string, currentAnswer: string): Promise<Response> {
    const session = await interviewRepository.findById(sessionId);
    if (session.sessionComplete) throw new Error("session_complete");

    // engineResultCache 존재 시: 캐시 데이터를 done 이벤트로 즉시 반환
    if (session.engineResultCache) {
      const engineResult = EngineAnswerResponseSchema.parse(session.engineResultCache);
      const doneEvent = {
        type: 'done',
        nextQuestion: engineResult.nextQuestion,
        updatedQueue: engineResult.updatedQueue,
        sessionComplete: engineResult.sessionComplete,
      };
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`));
          controller.close();
        },
      });
      return new Response(body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // SSE 연결 실패만 재시도
    const historyForEngine = session.history.map(({ type: _type, ...rest }) => rest);
    const fetchOptions = {
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
    };

    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${ENGINE_BASE_URL}/api/interview/answer?stream=true`, fetchOptions);
        if (!res.ok || !res.body) {
          throw new Error(`stream init failed: ${res.status}`);
        }
        return res;
      } catch (err) {
        lastErr = err;
        console.error(`[interviewService.answerStream] attempt ${attempt + 1} failed:`, err);
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      }
    }
    throw lastErr ?? new Error("engine_answer_stream_failed");
  },

  async answer(sessionId: string, currentAnswer: string): Promise<InterviewAnswerResponse> {
    const session = await interviewRepository.findById(sessionId);
    if (session.sessionComplete) throw new Error("session_complete");

    let engineResult: ReturnType<typeof EngineAnswerResponseSchema.parse>;

    if (session.engineResultCache) {
      engineResult = EngineAnswerResponseSchema.parse(session.engineResultCache);
    } else {
      const historyForEngine = session.history.map(({ type: _type, ...rest }) => rest);
      engineResult = await withEventLogging('interview_answer', sessionId, async (meta) => {
        let resp: Response | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          meta.retry_count = attempt;
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
        const d = await resp.json();
        if (d.usage) meta.usage = d.usage;
        return EngineAnswerResponseSchema.parse(d);
      });
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
    const resp = await withEventLogging('interview_followup', sessionId, async (meta) => {
      const r = await fetch(`${ENGINE_BASE_URL}/api/interview/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer, persona, resumeText }),
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) throw new Error("engine_followup_failed");
      const d = await r.json();
      if (d.usage) meta.usage = d.usage;
      return d;
    });
    return resp;
  },
};
