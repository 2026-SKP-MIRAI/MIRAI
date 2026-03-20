import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { fetchTrendSkills } from "@/lib/rag/embedding-client"

export const runtime = "nodejs"

/**
 * GET /api/resumes/trends?role=<직무명>&topK=<n>
 *
 * ENABLE_RAG guard: ENABLE_RAG 환경 변수가 "true"가 아닌 경우
 * 빈 결과를 즉시 반환한다.
 */
export async function GET(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: "인증이 필요합니다" }, { status: 401 })

  if (process.env.ENABLE_RAG !== "true") {
    return NextResponse.json({ skills: [], enabled: false })
  }

  const { searchParams } = new URL(request.url)
  const role = searchParams.get("role") ?? "소프트웨어 개발자"
  const topK = parseInt(searchParams.get("topK") ?? "10", 10)

  try {
    const skills = await fetchTrendSkills(role, topK)
    return NextResponse.json({ skills, enabled: true })
  } catch (err) {
    console.error("[GET /api/resumes/trends] error:", err instanceof Error ? err.message : String(err))
    return NextResponse.json({ skills: [], enabled: true }, { status: 500 })
  }
}
