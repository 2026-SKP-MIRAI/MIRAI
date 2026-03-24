import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { resumeRepository } from "@/lib/resume-repository"
import { uploadResumePdf } from "@/lib/resume-storage"
import { ENGINE_ERROR_MESSAGES, mapDetailToKey } from "@/lib/error-messages"
import { cookies } from "next/headers"
import { withEventLogging } from "@/lib/observability/event-logger"
import { normalizeRole } from "@/lib/role-normalizer"
import { embedText } from "@/lib/rag/embedding-client"
import { searchSimilarPostings, extractTrendSkills } from "@/lib/rag/vector-search"
import { searchSimilarAcceptedResumes } from "@/lib/rag/resume-search"
import type { TrendComparison } from "@/lib/types"

const MIN_SIMILARITY = 0.6

export const runtime = "nodejs"
export const maxDuration = 300

const ENGINE_BASE_URL = process.env.ENGINE_BASE_URL ?? "http://localhost:8000"

async function fetchFeedback(resumeText: string, targetRole: string, jobContext?: string[], resumeContext?: string[]) {
  return withEventLogging('resume_feedback', null, async (meta) => {
    const r = await fetch(`${ENGINE_BASE_URL}/api/resume/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeText,
        targetRole,
        ...(jobContext ? { job_context: jobContext } : {}),
        ...(resumeContext ? { resume_context: resumeContext } : {}),
      }),
      signal: AbortSignal.timeout(35000),
    })
    if (!r.ok) return null
    const d = await r.json().catch(() => null)
    if (d?.usage) meta.usage = d.usage
    return d
  }).catch((err) => {
    console.warn("[POST /api/resumes] feedback fetch failed:", err instanceof Error ? err.message : String(err))
    return null
  })
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: "인증이 필요합니다" }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ message: ENGINE_ERROR_MESSAGES.noFile }, { status: 400 })
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ message: ENGINE_ERROR_MESSAGES.noFile }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const targetRole = (formData.get("targetRole") as string | null) ?? ""
  const resumeText = (formData.get("resumeText") as string | null) ?? ""
  if (!resumeText) {
    return NextResponse.json({ message: ENGINE_ERROR_MESSAGES.llmError }, { status: 400 })
  }

  const normalizedRole = normalizeRole(targetRole) || null
  const enableRag = process.env.ENABLE_RAG === "true" && !!normalizedRole
  const enableResumeRag = process.env.ENABLE_RESUME_RAG === "true"
  console.log(`[RAG 설정] ENABLE_RAG=${enableRag} ENABLE_RESUME_RAG=${enableResumeRag} 직무=${normalizedRole ?? "미지정"}`)

  try {
    // upload + questions + (RAG 활성 시 embed) 병렬 실행
    const [storageKey, engineData, embResult] = await Promise.all([
      uploadResumePdf(user.id, buffer, file.name),
      withEventLogging('resume_questions', null, async (meta) => {
        const r = await fetch(`${ENGINE_BASE_URL}/api/resume/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeText, targetRole }),
          signal: AbortSignal.timeout(30000),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => ({ detail: "" }));
          const key = mapDetailToKey(body.detail ?? "", r.status);
          throw Object.assign(new Error(ENGINE_ERROR_MESSAGES[key]), { status: r.status, key });
        }
        const d = await r.json();
        if (d.usage) meta.usage = d.usage;
        return d;
      }),
      (enableRag || enableResumeRag)
        ? embedText(resumeText).catch(() => null)
        : Promise.resolve(null),
    ])

    // RAG: pgvector 검색 → job_context + resume_context 포함 단 1회 LLM 호출
    let feedbackJson = null
    let jobContext: string[] | undefined
    let resumeContext: string[] | undefined
    let trendComparison: TrendComparison | null = null

    if (embResult) {
      const [postings, acceptedResumes] = await Promise.all([
        enableRag
          ? searchSimilarPostings(embResult.vector, normalizedRole!, 5).catch(() => [])
          : Promise.resolve([]),
        enableResumeRag
          ? searchSimilarAcceptedResumes(embResult.vector, normalizedRole ?? undefined, 5).catch(() => [])
          : Promise.resolve([]),
      ])

      if (enableRag && postings.length > 0) {
        const relevant = postings.filter((p) => p.similarity >= MIN_SIMILARITY)
        jobContext = relevant.length > 0 ? relevant.map((p) => p.content) : undefined

        const rawSkills = extractTrendSkills(postings)
        const resumeTextLower = resumeText.toLowerCase()
        const trendSkillsWithMeta = rawSkills.map(({ skill, weight }) => ({
          skill,
          weight,
          inResume: resumeTextLower.includes(skill.toLowerCase()),
        }))
        const coveredCount = trendSkillsWithMeta.filter((s) => s.inResume).length
        const coverageScore = trendSkillsWithMeta.length > 0
          ? Math.round((coveredCount / trendSkillsWithMeta.length) * 100)
          : 0
        trendComparison = {
          role: normalizedRole!,
          trendSkills: trendSkillsWithMeta,
          coverageScore,
        }
      }

      if (enableResumeRag && acceptedResumes.length > 0) {
        const relevantResumes = acceptedResumes.filter((r) => r.similarity >= MIN_SIMILARITY)
        resumeContext = relevantResumes.length > 0 ? relevantResumes.map((r) => r.content) : undefined
        console.log(`[RAG:합격자소서] ${resumeContext?.length ?? 0}건 검색됨 → resume_context 주입`)
      } else if (enableResumeRag) {
        console.log("[RAG:합격자소서] 검색 결과 없음 → resume_context 미주입")
      }
    }

    feedbackJson = await fetchFeedback(resumeText, targetRole, jobContext, resumeContext)

    const resumeId = await resumeRepository.create({
      userId: user.id,
      fileName: file.name,
      storageKey,
      resumeText,
      questions: engineData.questions ?? [],
      feedbackJson: feedbackJson ?? null,
      trendComparison: trendComparison ?? null,
      inferredTargetRole: normalizedRole,
    })

    return NextResponse.json({ ...engineData, resumeId })
  } catch (err) {
    if (err instanceof Error && 'status' in err) {
      return NextResponse.json({ message: err.message }, { status: (err as { status: number }).status })
    }
    console.error("[POST /api/resumes] error:", err instanceof Error ? err.message : String(err))
    return NextResponse.json({ message: ENGINE_ERROR_MESSAGES.llmError }, { status: 500 })
  }
}

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: "인증이 필요합니다" }, { status: 401 })

  try {
    const resumes = await resumeRepository.listByUserId(user.id)
    const result = resumes.map(r => ({
      id: r.id,
      fileName: r.fileName,
      uploadedAt: r.createdAt.toISOString(),
      questionCount: Array.isArray(r.questions) ? (r.questions as unknown[]).length : 0,
      categories: [] as string[],
    }))
    return NextResponse.json(result)
  } catch (err) {
    console.error("[GET /api/resumes] error:", err instanceof Error ? err.message : String(err))
    return NextResponse.json([], { status: 200 })
  }
}
