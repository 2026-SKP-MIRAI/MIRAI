import { ENGINE_ERROR_MESSAGES } from "@/lib/error-messages";
import { interviewService } from "@/lib/interview/interview-service";
import type { PersonaType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 35;

export async function POST(request: Request) {
  const { sessionId, question, answer, persona } = await request.json();
  if (!sessionId || !question || !answer || !persona)
    return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewAnswerFailed }, { status: 400 });
  try {
    const result = await interviewService.followup(sessionId, question, answer, persona as PersonaType);
    return Response.json(result);
  } catch {
    return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewAnswerFailed }, { status: 500 });
  }
}
