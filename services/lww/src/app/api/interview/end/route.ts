import { z } from "zod";
import { engineFetch } from "@/lib/engine-client";

export const runtime = "nodejs";
export const maxDuration = 110;

const historyItemSchema = z.object({
  question: z.string().max(2000),
  answer: z.string().max(5000),
  persona: z.enum(["hr", "tech_lead", "executive"]),
  personaLabel: z.string().max(50),
});

const endSchema = z.object({
  resumeText: z.string().min(1).max(10000),
  history: z.array(historyItemSchema).min(5),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const parsed = endSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "입력값이 올바르지 않습니다.", errors: parsed.error.flatten() }, { status: 400 });
  }

  const { resumeText, history } = parsed.data;

  try {
    const resp = await engineFetch(
      "/api/report/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, history }),
      },
      105000 // 105s timeout (Vercel maxDuration=110 기준 마진 확보)
    );

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: "엔진 오류" }));
      return Response.json({ message: err.detail ?? "리포트 생성에 실패했습니다." }, { status: resp.status });
    }

    const report = await resp.json();
    return Response.json({ report });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return Response.json({ message: "리포트 생성 시간이 초과됐습니다. 다시 시도해주세요." }, { status: 504 });
    }
    console.error("[interview/end] 엔진 호출 실패:", err);
    return Response.json({ message: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
