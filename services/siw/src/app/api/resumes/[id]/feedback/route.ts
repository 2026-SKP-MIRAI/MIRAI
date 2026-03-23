import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { resumeRepository } from "@/lib/resume-repository"
import { cookies } from "next/headers"
import type { TrendComparison } from "@/lib/types"

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

  const feedback = resume.feedbackJson ?? null
  const trendComparison = (resume.trendComparison as TrendComparison | null) ?? null

  return NextResponse.json({ feedback, trendComparison })
}
