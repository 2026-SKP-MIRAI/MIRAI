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
  } catch {
    return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewStartFailed }, { status: 500 });
  }
}
