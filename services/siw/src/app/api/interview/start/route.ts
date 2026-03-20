import { ENGINE_ERROR_MESSAGES } from "@/lib/error-messages";
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

  const { resumeId, personas } = await request.json();
  if (!resumeId || !personas?.length)
    return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewStartFailed }, { status: 400 });
  try {
    const result = await interviewService.start(resumeId, personas as PersonaType[], user.id);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[interview/start] error:", message, err);
    if (message === "resume_not_found") {
      return Response.json({ message: "이력서를 찾을 수 없습니다." }, { status: 404 });
    }
    if (message === "engine_start_failed") {
      return Response.json({ message: "면접 엔진 호출에 실패했습니다. 엔진 서버가 실행 중인지 확인해주세요." }, { status: 503 });
    }
    return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewStartFailed }, { status: 500 });
  }
}
