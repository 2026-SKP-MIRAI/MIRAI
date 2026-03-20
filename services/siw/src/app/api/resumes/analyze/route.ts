import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { ENGINE_ERROR_MESSAGES, mapDetailToKey } from "@/lib/error-messages"
import { withEventLogging } from "@/lib/observability/event-logger"
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

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ message: ENGINE_ERROR_MESSAGES.noFile }, { status: 400 })
  }

  try {
    const result = await withEventLogging('resume_analyze', null, async (meta) => {
      const engineForm = new FormData()
      engineForm.append("file", file, file.name)

      const resp = await fetch(`${ENGINE_BASE_URL}/api/resume/analyze`, {
        method: "POST",
        body: engineForm,
        signal: AbortSignal.timeout(55000),
      })

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ detail: "" }))
        const key = mapDetailToKey(body.detail ?? "", resp.status)
        throw Object.assign(new Error(ENGINE_ERROR_MESSAGES[key]), { status: resp.status })
      }

      const d = await resp.json()
      if (d.usage) meta.usage = d.usage
      return d as { resumeText: string; extractedLength: number; targetRole: string }
    })

    if (!result.resumeText) {
      return NextResponse.json({ message: ENGINE_ERROR_MESSAGES.llmError }, { status: 422 })
    }

    return NextResponse.json({
      resumeText: result.resumeText,
      targetRole: result.targetRole,
    })
  } catch (err) {
    if (err instanceof Error && 'status' in err) {
      return NextResponse.json({ message: err.message }, { status: (err as { status: number }).status })
    }
    if (err instanceof Error && err.name === "TimeoutError") {
      return NextResponse.json({ message: ENGINE_ERROR_MESSAGES.llmError }, { status: 504 })
    }
    return NextResponse.json({ message: ENGINE_ERROR_MESSAGES.llmError }, { status: 500 })
  }
}
