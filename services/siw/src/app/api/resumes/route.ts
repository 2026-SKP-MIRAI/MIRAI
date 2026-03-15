import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { resumeRepository } from "@/lib/resume-repository"
import { cookies } from "next/headers"

export const runtime = "nodejs"

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: "인증이 필요합니다" }, { status: 401 })

  try {
    // ResumeSession에 userId 필드 없음 — 인증 가드만 적용, 추후 userId 컬럼 추가 시 필터링 적용
    const sessions = await resumeRepository.listAll()
    const result = sessions.map(s => ({
      id: s.id,
      fileName: s.resumeText.slice(0, 30) + (s.resumeText.length > 30 ? "…" : ""),
      uploadedAt: s.createdAt.toISOString(),
      questionCount: 0,
      categories: [] as string[],
    }))
    return NextResponse.json(result)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
