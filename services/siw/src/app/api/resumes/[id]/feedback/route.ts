import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { resumeRepository } from "@/lib/resume-repository"
import { cookies } from "next/headers"

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
  try {
    // Resume 모델에 feedbackJson 컬럼이 없어 항상 null 반환
    // 엔진에 resume feedback 엔드포인트 추가 시 여기에 연동
    await resumeRepository.findDetailById(id, user.id) // 소유권 확인
    return NextResponse.json(null)
  } catch {
    return NextResponse.json(null)
  }
}
