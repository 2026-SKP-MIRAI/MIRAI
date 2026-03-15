import { ENGINE_ERROR_MESSAGES } from "@/lib/error-messages";
import { interviewRepository } from "@/lib/interview/interview-repository";
import { createServerClient } from "@/lib/supabase/server";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ message: "인증이 필요합니다" }, { status: 401 });

  const body = await request.json();
  const { sessionId } = body;

  if (!sessionId)
    return Response.json({ message: ENGINE_ERROR_MESSAGES.sessionNotFound }, { status: 400 });

  try {
    const session = await interviewRepository.findById(sessionId);
    if (session.userId !== user.id) return Response.json({ message: "권한이 없습니다" }, { status: 403 });

    if (session.history.length < 5)
      return Response.json(
        { message: "질문을 더 진행해 주세요 (최소 5개 필요합니다)." },
        { status: 422 }
      );

    const history = session.history.map(({ type: _type, ...rest }) => rest);

    const engineUrl =
      (process.env.ENGINE_BASE_URL ?? "http://localhost:8000") + "/api/report/generate";

    const engineRes = await fetch(engineUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText: session.resumeText, history }),
      signal: AbortSignal.timeout(90000),
    });

    const data = await engineRes.json();

    // best-effort: 리포트 점수 저장 (실패 시 1회 재시도)
    if (engineRes.ok && data.scores && typeof data.totalScore === "number") {
      const saveWithRetry = async () => {
        try {
          await interviewRepository.saveReport(sessionId, data.scores, data.totalScore);
        } catch (err) {
          console.error("[report/generate] saveReport failed, retrying in 2s:", err);
          await new Promise(r => setTimeout(r, 2000));
          interviewRepository.saveReport(sessionId, data.scores, data.totalScore).catch((err2) => {
            console.error("[report/generate] saveReport retry failed:", err2);
          });
        }
      };
      saveWithRetry();
    }

    return Response.json(data, { status: engineRes.status });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025")
      return Response.json({ message: ENGINE_ERROR_MESSAGES.sessionNotFound }, { status: 404 });
    return Response.json({ message: "리포트 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
