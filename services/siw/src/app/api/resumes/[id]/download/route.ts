import { NextResponse } from "next/server"
import { createServerClient, createServiceClient } from "@/lib/supabase/server"
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

  let resume
  try {
    resume = await resumeRepository.findDetailById(id, user.id)
  } catch {
    return NextResponse.json({ message: "이력서를 찾을 수 없습니다." }, { status: 404 })
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET
  if (!bucket) return NextResponse.json({ message: "스토리지 설정 오류" }, { status: 500 })

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient.storage
    .from(bucket)
    .createSignedUrl(resume.storageKey, 60) // 60초 유효

  if (error || !data) {
    return NextResponse.json({ message: "다운로드 URL 생성 실패" }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl, fileName: resume.fileName })
}
