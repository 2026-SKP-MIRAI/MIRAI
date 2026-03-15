import { NextResponse } from "next/server"
import { resumeRepository } from "@/lib/resume-repository"

export const runtime = "nodejs"

// TODO: userId 필터는 인증 구현(#89) 후 추가
export async function GET() {
  try {
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
