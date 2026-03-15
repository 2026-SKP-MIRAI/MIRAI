import { ENGINE_ERROR_MESSAGES } from "@/lib/error-messages";
import { interviewRepository } from "@/lib/interview/interview-repository";
import { interviewService } from "@/lib/interview/interview-service";
import { createServerClient } from "@/lib/supabase/server";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    // ownership 체크
    const session = await interviewRepository.findById(sessionId);
    if (session.userId !== user.id) return Response.json({ message: "권한이 없습니다" }, { status: 403 });

    const result = await interviewService.answer(sessionId, trimmedAnswer);
    return Response.json(result);
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
