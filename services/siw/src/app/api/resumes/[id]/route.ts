import { NextResponse } from "next/server"
import { resumeRepository } from "@/lib/resume-repository"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await resumeRepository.findDetailById(id)
    return NextResponse.json({
      id: session.id,
      fileName: session.resumeText.slice(0, 30) + (session.resumeText.length > 30 ? "…" : ""),
      uploadedAt: session.createdAt.toISOString(),
      resumeText: session.resumeText,
      questionCount: 0,
      categories: [] as string[],
    })
  } catch {
    return NextResponse.json({ message: "이력서를 찾을 수 없습니다." }, { status: 404 })
  }
}
