import { z } from "zod";
import { NextResponse } from "next/server";
import { engineFetch } from "@/lib/engine-client";
import { getOrCreateAnonId, setAnonCookie } from "@/lib/anon-cookie";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/get-current-user-id";

export const runtime = "nodejs";

const startSchema = z.object({
  jobCategories: z.array(z.string().min(1)).min(1).max(3),
  careerStage: z.string().min(1),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "입력값이 올바르지 않습니다.", errors: parsed.error.flatten() }, { status: 400 });
  }

  const { jobCategories, careerStage } = parsed.data;
  const resumeText = `직군: ${jobCategories.join(", ")} / 취준 단계: ${careerStage}`;
  const sessionId = crypto.randomUUID();

  try {
    const resp = await engineFetch("/api/interview/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText, personas: ["hr", "tech_lead", "executive"] }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: "엔진 오류" }));
      return Response.json({ message: err.detail ?? "면접 시작에 실패했습니다." }, { status: resp.status });
    }

    const data = await resp.json();
    // MVP: 5문항 제한 (첫 질문 1 + 큐 4)
    const { anonymousId, isNew } = await getOrCreateAnonId();
    const userId = await getCurrentUserId();
    const supabase = createServiceClient();
    const { error: dbError } = await supabase.from("interview_sessions").insert({
      id: sessionId,
      anonymous_id: anonymousId,
      user_id: userId,        // ← 추가 (로그인이면 auth.uid(), 아니면 null)
      job_category: jobCategories.join(", "),
      questions: [data.firstQuestion, ...(data.questionsQueue ?? []).slice(0, 4)],
      history: [],
      questions_queue: (data.questionsQueue ?? []).slice(0, 4),
      status: "in_progress",
    });
    if (dbError) console.error("[start] DB INSERT 실패 (non-fatal):", dbError);

    const jsonResponse = NextResponse.json({
      sessionId,
      firstQuestion: data.firstQuestion,
      questionsQueue: (data.questionsQueue ?? []).slice(0, 4),
    });
    return isNew ? setAnonCookie(jsonResponse, anonymousId) : jsonResponse;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return Response.json({ message: "응답 시간이 초과됐습니다." }, { status: 504 });
    }
    console.error("[interview/start] 엔진 호출 실패:", err);
    return Response.json({ message: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
