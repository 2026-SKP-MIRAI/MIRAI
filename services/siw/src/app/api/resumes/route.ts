import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { resumeRepository } from "@/lib/resume-repository"
import { uploadResumePdf } from "@/lib/resume-storage"
import { parsePdf } from "@/lib/pdf-parser"
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

  let resumeText = ""
  try {
    resumeText = await parsePdf(buffer)
  } catch {
    return NextResponse.json({ message: ENGINE_ERROR_MESSAGES.corruptedPdf }, { status: 422 })
  }

  const engineForm = new FormData()
  engineForm.append("file", file, file.name)

  try {
    const resp = await fetch(`${ENGINE_BASE_URL}/api/resume/questions`, {
      method: "POST",
      body: engineForm,
      signal: AbortSignal.timeout(30000),
    })

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({ detail: "" }))
      const key = mapDetailToKey(body.detail ?? "", resp.status)
      return NextResponse.json({ message: ENGINE_ERROR_MESSAGES[key] }, { status: resp.status })
    }

    const engineData = await resp.json()
    const storageKey = await uploadResumePdf(user.id, buffer, file.name)
    const resumeId = await resumeRepository.create({
      userId: user.id,
      fileName: file.name,
      storageKey,
      resumeText,
      questions: engineData.questions ?? [],
    })

    return NextResponse.json({ ...engineData, resumeId })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[POST /api/resumes] error:", message)
    return NextResponse.json({ message, detail: message }, { status: 500 })
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
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
