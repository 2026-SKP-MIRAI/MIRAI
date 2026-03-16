import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
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

  const { id: resumeId } = await params

  // 이 이력서가 해당 유저 소유인지 확인
  const resume = await prisma.resume.findFirst({ where: { id: resumeId, userId: user.id } })
  if (!resume) return NextResponse.json({ message: "이력서를 찾을 수 없습니다." }, { status: 404 })

  const sessions = await prisma.interviewSession.findMany({
    where: {
      resumeId,
      userId: user.id,
      sessionComplete: true,
      interviewMode: "real",
      reportScores: { not: Prisma.DbNull },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      reportTotalScore: true,
      reportScores: true,
    },
  })

  return NextResponse.json(sessions.map(s => ({
    id: s.id,
    createdAt: s.createdAt.toISOString(),
    reportTotalScore: s.reportTotalScore,
    scores: s.reportScores,
  })))
}
