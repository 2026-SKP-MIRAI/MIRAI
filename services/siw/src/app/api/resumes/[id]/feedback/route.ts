import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { resumeRepository } from "@/lib/resume-repository"
import { cookies } from "next/headers"
import { embedText } from "@/lib/rag/embedding-client"
import { searchSimilarPostings, extractTrendSkills } from "@/lib/rag/vector-search"
import type { FeedbackTrendComparison } from "@/lib/types"

export const runtime = "nodejs"

const ENGINE_BASE_URL = process.env.ENGINE_BASE_URL ?? "http://localhost:8000"

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

  let feedback = resume.feedbackJson ?? null
  let trendComparison: FeedbackTrendComparison | null = null

  const MIN_SIMILARITY = 0.6

  if (process.env.ENABLE_RAG === "true" && resume.inferredTargetRole) {
    try {
      const embResult = await embedText(resume.resumeText ?? "")
      if (embResult) {
        const postings = await searchSimilarPostings(embResult.vector, resume.inferredTargetRole, 5)
        const relevantPostings = postings.filter((p) => p.similarity >= MIN_SIMILARITY)

        // 유사도 임계값(0.6) 이상인 공고가 있을 때만 엔진 재호출
        if (relevantPostings.length > 0) {
          const jobContext = relevantPostings.map((p) => p.content)
          const engineResp = await fetch(`${ENGINE_BASE_URL}/api/resume/feedback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              resumeText: resume.resumeText,
              targetRole: resume.inferredTargetRole,
              job_context: jobContext,
            }),
            signal: AbortSignal.timeout(30000),
          })
          if (engineResp.ok) {
            feedback = await engineResp.json().catch(() => feedback)
          }
        }

        const trendSkills = extractTrendSkills(postings)
        trendComparison = {
          trendingSkills: trendSkills.map((s) => s.skill),
          similarPostings: postings.map((p) => ({
            title: p.title,
            company: p.company,
            similarity: p.similarity,
            sourceUrl: p.sourceUrl,
          })),
        }
      }
    } catch {
      // RAG 실패 시 기존 feedback + null trendComparison 유지
    }
  }

  return NextResponse.json({ feedback, trendComparison })
}
