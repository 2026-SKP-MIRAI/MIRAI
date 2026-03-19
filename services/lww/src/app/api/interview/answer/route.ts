import { z } from "zod";
import { engineFetch } from "@/lib/engine-client";

export const runtime = "nodejs";

const historyItemSchema = z.object({
  question: z.string().max(2000),
  answer: z.string().max(5000),
  persona: z.enum(["hr", "tech_lead", "executive"]),
  personaLabel: z.string().max(50),
});

const queueItemSchema = z.object({
  question: z.string().max(2000).optional(),
  persona: z.enum(["hr", "tech_lead", "executive"]),
  type: z.enum(["main", "follow_up"]),
});

const answerSchema = z.object({
  resumeText: z.string().min(1).max(10000),
  currentQuestion: z.string().min(1).max(2000),
  currentAnswer: z.string().min(1).max(5000),
  currentPersona: z.enum(["hr", "tech_lead", "executive"]),
  history: z.array(historyItemSchema).max(20),
  questionsQueue: z.array(queueItemSchema),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const parsed = answerSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "입력값이 올바르지 않습니다.", errors: parsed.error.flatten() }, { status: 400 });
  }

  const { resumeText, currentQuestion, currentAnswer, currentPersona, history, questionsQueue } = parsed.data;

  try {
    const resp = await engineFetch("/api/interview/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeText,
        currentQuestion,
        currentAnswer,
        currentPersona,
        history,
        questionsQueue,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: "엔진 오류" }));
      return Response.json({ message: err.detail ?? "답변 처리에 실패했습니다." }, { status: resp.status });
    }

    const data = await resp.json();
    // 엔진은 updatedHistory를 반환하지 않음 — 클라이언트가 직접 누적
    return Response.json({
      nextQuestion: data.nextQuestion,
      updatedQueue: data.updatedQueue,
      sessionComplete: data.sessionComplete,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return Response.json({ message: "응답 시간이 초과됐습니다." }, { status: 504 });
    }
    console.error("[interview/answer] 엔진 호출 실패:", err);
    return Response.json({ message: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
