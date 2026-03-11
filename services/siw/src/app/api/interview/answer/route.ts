import { ENGINE_ERROR_MESSAGES } from "@/lib/error-messages";
import { interviewService } from "@/lib/interview/interview-service";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const { sessionId, currentAnswer } = await request.json();
  if (!sessionId || !currentAnswer)
    return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewAnswerFailed }, { status: 400 });

  // 공백만인 답변 조기 차단 — DB/engine 호출 방지
  if (!currentAnswer.trim())
    return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewAnswerFailed }, { status: 400 });

  // 5000자 초과 트림 — engine 토큰 비용 절감
  const trimmedAnswer = currentAnswer.trim().slice(0, 5000);

  try {
    const result = await interviewService.answer(sessionId, trimmedAnswer);
    return Response.json(result);
  } catch (e) {
    if (e instanceof Error && e.message === "session_complete")
      return Response.json({ message: "이미 완료된 면접 세션입니다." }, { status: 400 });
    const status =
      e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025" ? 404 : 500;
    return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewAnswerFailed }, { status });
  }
}
