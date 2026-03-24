import { ENGINE_ERROR_MESSAGES } from "@/lib/error-messages";
import { interviewRepository } from "@/lib/interview/interview-repository";
import { interviewService } from "@/lib/interview/interview-service";
import { EngineAnswerResponseSchema } from "@/lib/interview/schemas";
import { parseSSEStream } from "@/lib/sse-utils";
import type { SSEEvent } from "@/lib/sse-utils";
import { createServerClient } from "@/lib/supabase/server";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import type { PersonaType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const PERSONA_LABELS: Record<string, string> = {
  hr: "HR 담당자",
  tech_lead: "기술 리드",
  executive: "임원",
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ message: "인증이 필요합니다" }, { status: 401 });

  const { sessionId, currentAnswer } = await request.json();
  if (!sessionId || !currentAnswer)
    return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewAnswerFailed }, { status: 400 });

  // 공백만인 답변 조기 차단 — DB/engine 호출 방지
  if (!currentAnswer.trim())
    return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewAnswerFailed }, { status: 400 });

  // 5000자 초과 트림 — engine 토큰 비용 절감
  const trimmedAnswer = currentAnswer.trim().slice(0, 5000);

  try {
    // ownership 체크 + 세션 상태 조회 (drain에서 history 업데이트에 필요)
    const session = await interviewRepository.findById(sessionId);
    if (session.userId !== user.id) return Response.json({ message: "권한이 없습니다" }, { status: 403 });

    const engineResponse = await interviewService.answerStream(sessionId, trimmedAnswer);

    if (!engineResponse.body) {
      return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewAnswerFailed }, { status: 502 });
    }

    const encoder = new TextEncoder();
    const [drainStream, clientStream] = engineResponse.body.tee();

    // drain task: 클라이언트 disconnect 무관하게 done까지 완주
    // engineResultCache 보호 및 DB 업데이트 보장
    const drainPromise = (async () => {
      try {
        for await (const event of parseSSEStream(drainStream)) {
          if (event.type === 'done') {
            const doneEvent = event as Extract<SSEEvent, { type: 'done' }>;
            try {
              // EngineAnswerResponseSchema로 파싱하여 타입 안전성 확보
              const engineResult = EngineAnswerResponseSchema.parse({
                nextQuestion: doneEvent.nextQuestion,
                updatedQueue: doneEvent.updatedQueue,
                sessionComplete: doneEvent.sessionComplete,
              });

              // write-ahead cache 저장
              await interviewRepository.saveEngineResult(sessionId, engineResult);

              // history 업데이트 + cache null 처리
              const updatedHistory = [
                ...session.history,
                {
                  persona: session.currentPersona as PersonaType,
                  personaLabel: PERSONA_LABELS[session.currentPersona] ?? session.currentPersona,
                  question: session.currentQuestion,
                  answer: trimmedAnswer,
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
            } catch (dbErr) {
              console.error("[answer] drain DB 처리 실패:", dbErr);
            }
          }
        }
      } catch (err) {
        // drain 실패는 무시 — 클라이언트에는 이미 스트림 전달됨
        console.error("[answer] drain stream 처리 오류:", err);
      }
    })();

    // 클라이언트 스트림 파스스루
    const responseStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of parseSSEStream(clientStream)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          }
        } catch {
          // 클라이언트 disconnect — drain은 계속 진행
        }
        controller.close();
        // 클라이언트 스트림 종료 후 drain 완료 대기 (disconnect 후에도 DB 업데이트 보장)
        await drainPromise;
      },
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "session_complete")
      return Response.json({ message: "이미 완료된 면접 세션입니다." }, { status: 400 });
    if (e instanceof Error && e.message === "session_not_found")
      return Response.json({ message: ENGINE_ERROR_MESSAGES.sessionNotFound }, { status: 404 });
    const status =
      e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025" ? 404 : 500;
    return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewAnswerFailed }, { status });
  }
}
