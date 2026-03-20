import { withEventLogging } from "@/lib/observability/event-logger";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json();
  const { question, answer, previousAnswer, previousScore: rawPreviousScore } = body;
  // TODO(#102): 향후 DB에서 세션의 마지막 점수를 조회하는 로직으로 교체
  //   const previousScore = await getPreviousScoreFromDB(sessionId);
  const previousScore = (typeof rawPreviousScore === "number" && rawPreviousScore >= 0 && rawPreviousScore <= 100)
    ? rawPreviousScore : undefined;

  const engineUrl =
    (process.env.ENGINE_BASE_URL ?? "http://localhost:8000") + "/api/practice/feedback";

  try {
    const data = await withEventLogging('practice_feedback', null, async (meta) => {
      const engineRes = await fetch(engineUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer, previousAnswer, previousScore }),
        signal: AbortSignal.timeout(30000),
      });
      const d = await engineRes.json();
      if (!engineRes.ok)
        throw Object.assign(new Error("engine_practice_failed"), { data: d, status: engineRes.status });
      if (d.usage) meta.usage = d.usage;
      return d;
    });
    return Response.json(data, { status: 200 });
  } catch (err) {
    if (err instanceof Error && 'data' in err) {
      const errData = (err as { data: { detail?: string } }).data;
      const status = (err as unknown as { status: number }).status;
      if (status === 400)
        return Response.json({ message: errData.detail ?? "잘못된 요청입니다." }, { status: 400 });
      return Response.json({ message: "피드백 생성에 실패했습니다." }, { status: 500 });
    }
    return Response.json({ message: "피드백 생성에 실패했습니다." }, { status: 500 });
  }
}
