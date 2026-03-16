import { interviewRepository } from "@/lib/interview/interview-repository";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type { GrowthSession, AxisScores } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return Response.json({ message: "인증이 필요합니다" }, { status: 401 });

    const sessions = await interviewRepository.listCompleted(user.id);

    const result: GrowthSession[] = sessions.map((s) => {
      const rj = s.reportJson as { axisFeedbacks?: import("@/lib/types").AxisFeedback[] } | null;
      return {
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        reportTotalScore: s.reportTotalScore,
        scores: s.reportScores as AxisScores,
        resumeLabel: s.resumeText.slice(0, 30) + (s.resumeText.length > 30 ? "…" : ""),
        axisFeedbacks: rj?.axisFeedbacks ?? undefined,
      };
    });

    return Response.json(result);
  } catch {
    return Response.json({ message: "성장 데이터를 불러오는 중 오류가 발생했습니다." }, { status: 500 });
  }
}
