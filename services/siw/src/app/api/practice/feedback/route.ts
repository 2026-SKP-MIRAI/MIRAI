export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json();
  const { question, answer, previousAnswer } = body;

  const engineUrl =
    (process.env.ENGINE_BASE_URL ?? "http://localhost:8000") + "/api/practice/feedback";

  try {
    const engineRes = await fetch(engineUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer, previousAnswer }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await engineRes.json();

    if (engineRes.status === 400)
      return Response.json({ message: data.detail ?? "잘못된 요청입니다." }, { status: 400 });

    if (!engineRes.ok)
      return Response.json({ message: "피드백 생성에 실패했습니다." }, { status: 500 });

    return Response.json(data, { status: 200 });
  } catch {
    return Response.json({ message: "피드백 생성에 실패했습니다." }, { status: 500 });
  }
}
