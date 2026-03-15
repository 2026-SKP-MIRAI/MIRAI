import { interviewRepository } from "@/lib/interview/interview-repository";
import type { GrowthSession, AxisScores } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sessions = await interviewRepository.listCompleted();

    const result: GrowthSession[] = sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      reportTotalScore: s.reportTotalScore,
      scores: s.reportScores as AxisScores,
      resumeLabel: s.resumeText.slice(0, 30) + (s.resumeText.length > 30 ? "…" : ""),
    }));

    return Response.json(result);
  } catch {
    return Response.json({ message: "성장 데이터를 불러오는 중 오류가 발생했습니다." }, { status: 500 });
  }
}
