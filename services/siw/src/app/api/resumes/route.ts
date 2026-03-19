import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { resumeRepository } from "@/lib/resume-repository"
import { uploadResumePdf } from "@/lib/resume-storage"
import { ENGINE_ERROR_MESSAGES, mapDetailToKey } from "@/lib/error-messages"
import { cookies } from "next/headers"

export const runtime = "nodejs"
export const maxDuration = 60

const ENGINE_BASE_URL = process.env.ENGINE_BASE_URL ?? "http://localhost:8000"

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

  const engineParseForm = new FormData()
  engineParseForm.append("file", file, file.name)
  const parseResp = await fetch(`${ENGINE_BASE_URL}/api/resume/parse`, {
    method: "POST",
    body: engineParseForm,
    signal: AbortSignal.timeout(30000),
  })
  if (!parseResp.ok) {
    const body = await parseResp.json().catch(() => ({ detail: "" }))
    const key = mapDetailToKey(body.detail ?? "", parseResp.status)
    return NextResponse.json({ message: ENGINE_ERROR_MESSAGES[key] }, { status: parseResp.status })
  }
  const { resumeText } = await parseResp.json()

  const targetRole = (formData.get("targetRole") as string | null) ?? "소프트웨어 개발자"

  try {
    const [storageKey, engineData, feedbackJson] = await Promise.all([
      uploadResumePdf(user.id, buffer, file.name),
      fetch(`${ENGINE_BASE_URL}/api/resume/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText }),
        signal: AbortSignal.timeout(30000),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({ detail: "" }))
          const key = mapDetailToKey(body.detail ?? "", r.status)
          throw Object.assign(new Error(ENGINE_ERROR_MESSAGES[key]), { status: r.status, key })
        }
        return r.json()
      }),
      fetch(`${ENGINE_BASE_URL}/api/resume/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, targetRole }),
        signal: AbortSignal.timeout(35000),
      }).then(r => r.ok ? r.json() : null).catch((err) => {
        console.warn("[POST /api/resumes] feedback fetch failed:", err instanceof Error ? err.message : String(err));
        return null;
      }),
    ])

    const resumeId = await resumeRepository.create({
      userId: user.id,
      fileName: file.name,
      storageKey,
      resumeText,
      questions: engineData.questions ?? [],
      feedbackJson: feedbackJson ?? null,
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
