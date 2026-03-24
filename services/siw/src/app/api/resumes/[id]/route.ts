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
  try {
    const resume = await resumeRepository.findDetailById(id, user.id)
    return NextResponse.json({
      id: resume.id,
      fileName: resume.fileName,
      resumeText: resume.resumeText,
      questions: resume.questions,
      uploadedAt: resume.createdAt.toISOString(),
      inferredTargetRole: resume.inferredTargetRole ?? null,
    })
  } catch {
    return NextResponse.json({ message: "이력서를 찾을 수 없습니다." }, { status: 404 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies()
  const supabase = createServerClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: "인증이 필요합니다" }, { status: 401 })

  const { id } = await params

  let resume: Awaited<ReturnType<typeof resumeRepository.findById>>
  try {
    resume = await resumeRepository.findById(id)
  } catch {
    return NextResponse.json({ message: "이력서를 찾을 수 없습니다." }, { status: 404 })
  }

  if (resume.userId !== user.id) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 })
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET
  if (bucket) {
    try {
      const serviceClient = createServiceClient()
      await serviceClient.storage.from(bucket).remove([resume.storageKey])
    } catch {
      // Storage 삭제 실패는 무시하고 DB 삭제 진행
    }
  }

  await resumeRepository.deleteById(id, user.id)

  return NextResponse.json({ message: "삭제되었습니다." }, { status: 200 })
}
