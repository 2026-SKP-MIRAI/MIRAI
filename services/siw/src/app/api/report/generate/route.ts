import { ENGINE_ERROR_MESSAGES } from "@/lib/error-messages";
import { interviewRepository } from "@/lib/interview/interview-repository";
import { withEventLogging } from "@/lib/observability/event-logger";
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
    const session = await interviewRepository.findById(sessionId, user.id);

    // 캐시 확인: 완료된 세션에 이미 생성된 리포트가 있으면 즉시 반환
    if (session.sessionComplete && session.reportJson) {
      return Response.json(session.reportJson);
    }

    if (!session.sessionComplete)
      return Response.json({ message: ENGINE_ERROR_MESSAGES.sessionNotComplete }, { status: 400 });

    if (session.history.length < 5)
      return Response.json(
        { message: "질문을 더 진행해 주세요 (최소 5개 필요합니다)." },
        { status: 422 }
      );

    const history = session.history.map(({ type: _type, ...rest }) => rest);

    const engineUrl =
      (process.env.ENGINE_BASE_URL ?? "http://localhost:8000") + "/api/report/generate";

    let engineData: unknown;
    let engineStatus: number;
    try {
      const result = await withEventLogging('report_generate', sessionId, async (meta) => {
        const engineRes = await fetch(engineUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeText: session.resumeText, history }),
          signal: AbortSignal.timeout(90000),
        });
        const d = await engineRes.json();
        if (!engineRes.ok)
          throw Object.assign(new Error("engine_report_failed"), { data: d, status: engineRes.status });
        if (d.usage) meta.usage = d.usage;
        return { data: d, status: engineRes.status };
      });
      engineData = result.data;
      engineStatus = result.status;
    } catch (err) {
      if (err instanceof Error && 'data' in err) {
        return Response.json((err as { data: unknown }).data, { status: (err as unknown as { status: number }).status });
      }
      throw err;
    }

    // best-effort: 리포트 전체 JSON + 점수 저장 (실패 시 1회 재시도)
    const data = engineData as Record<string, unknown>;
    if (data.scores && typeof data.totalScore === "number") {
      const saveWithRetry = async () => {
        try {
          await interviewRepository.saveReport(sessionId, user.id, data.scores as unknown as import("@/lib/types").AxisScores, data.totalScore as number, data);
        } catch (err) {
          console.error("[report/generate] saveReport failed, retrying in 2s:", err);
          await new Promise(r => setTimeout(r, 2000));
          try {
            await interviewRepository.saveReport(sessionId, user.id, data.scores as unknown as import("@/lib/types").AxisScores, data.totalScore as number, data);
          } catch (err2) {
            console.error("[report/generate] saveReport retry failed:", err2);
          }
        }
      };
      await saveWithRetry();
    }

    return Response.json(engineData, { status: engineStatus });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025")
      return Response.json({ message: ENGINE_ERROR_MESSAGES.sessionNotFound }, { status: 404 });
    return Response.json({ message: "리포트 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
