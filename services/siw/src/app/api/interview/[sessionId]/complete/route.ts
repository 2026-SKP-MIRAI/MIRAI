import { interviewRepository } from "@/lib/interview/interview-repository";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function PATCH(
  _request: Request,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;

  try {
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
