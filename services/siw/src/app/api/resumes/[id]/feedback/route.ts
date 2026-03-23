import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { resumeRepository } from "@/lib/resume-repository"
import { cookies } from "next/headers"
import { embedText } from "@/lib/rag/embedding-client"
import { searchSimilarPostings, getTrendSkillsForRole } from "@/lib/rag/vector-search"
import type { FeedbackTrendComparison } from "@/lib/types"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies()
  const supabase = createServerClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: "인증이 필요합니다" }, { status: 401 })

  const { id } = await params
  let resume: Awaited<ReturnType<typeof resumeRepository.findDetailById>>
  try {
    resume = await resumeRepository.findDetailById(id, user.id)
  } catch {
    return NextResponse.json({ message: "이력서를 찾을 수 없습니다." }, { status: 404 })
  }

  let trendComparison: FeedbackTrendComparison | null = null

  if (process.env.ENABLE_RAG === "true" && resume.inferredTargetRole) {
    try {
      const embResult = await embedText(resume.resumeText ?? "")
      if (embResult) {
        const [trendingSkills, similarPostings] = await Promise.all([
          getTrendSkillsForRole(embResult.vector, resume.inferredTargetRole),
          searchSimilarPostings(embResult.vector, resume.inferredTargetRole, 5),
        ])
        trendComparison = { trendingSkills, similarPostings }
      }
    } catch {
      // RAG 실패 시 null 유지
    }
  }

  return NextResponse.json({
    feedback: resume.feedbackJson ?? null,
    trendComparison,
  })
}
