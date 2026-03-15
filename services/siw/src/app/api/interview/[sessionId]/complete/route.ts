import { interviewRepository } from "@/lib/interview/interview-repository";
import { createServerClient } from "@/lib/supabase/server";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ message: "인증이 필요합니다" }, { status: 401 });

  const { sessionId } = await params;

  try {
    // ownership 체크
    const session = await interviewRepository.findById(sessionId);
    if (session.userId !== user.id) return Response.json({ message: "권한이 없습니다" }, { status: 403 });

    await interviewRepository.complete(sessionId);
    return Response.json({ ok: true });
  } catch (e) {
    if (
      e instanceof Error && e.message === "session_not_found" ||
      e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025"
    ) {
      return Response.json({ message: "세션을 찾을 수 없습니다." }, { status: 404 });
    }
    return Response.json({ message: "면접 종료 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
