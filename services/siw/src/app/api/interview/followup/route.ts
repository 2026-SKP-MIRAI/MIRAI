import { ENGINE_ERROR_MESSAGES } from "@/lib/error-messages";
import { interviewRepository } from "@/lib/interview/interview-repository";
import { interviewService } from "@/lib/interview/interview-service";
import { createServerClient } from "@/lib/supabase/server";
import type { PersonaType } from "@/lib/types";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 35;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ message: "인증이 필요합니다" }, { status: 401 });

  const { sessionId, question, answer, persona } = await request.json();
  if (!sessionId || !question || !answer || !persona)
    return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewAnswerFailed }, { status: 400 });
  try {
    // ownership 체크
    const session = await interviewRepository.findById(sessionId);
    if (session.userId !== user.id) return Response.json({ message: "권한이 없습니다" }, { status: 403 });

    const result = await interviewService.followup(sessionId, question, answer, persona as PersonaType);
    return Response.json(result);
  } catch {
    return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewAnswerFailed }, { status: 500 });
  }
}
