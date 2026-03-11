import { ENGINE_ERROR_MESSAGES } from "@/lib/error-messages";
import { interviewService } from "@/lib/interview/interview-service";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const { sessionId, currentAnswer } = await request.json();
  if (!sessionId || !currentAnswer)
    return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewAnswerFailed }, { status: 400 });
  try {
    const result = await interviewService.answer(sessionId, currentAnswer);
    return Response.json(result);
  } catch (e) {
    const status =
      e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025" ? 404 : 500;
    return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewAnswerFailed }, { status });
  }
}
