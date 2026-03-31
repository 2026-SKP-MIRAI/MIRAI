import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

type SessionWithReport = {
  id: string
  sessionComplete: boolean
  updatedAt: Date
  report: { id: string; createdAt: Date; totalScore: number } | null
}

type ResumeWithSessions = {
  id: string
  createdAt: Date
  fileName: string | null
  diagnosisResult: unknown
  sessions: SessionWithReport[]
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  let resumes: ResumeWithSessions[]
  try {
    resumes = await prisma.resume.findMany({
      where: { userId: user.id },
      take: 50,
      include: {
        sessions: {
          include: { report: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  } catch (err) {
    console.error('[dashboard] findMany failed', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  const result = resumes.map((resume) => {
    const reportSession = resume.sessions.find((s) => s.report !== null)

    const sessionsWithReport = resume.sessions.filter(
      (s): s is typeof s & { report: NonNullable<typeof s.report> } => s.report !== null
    )
    const reports = sessionsWithReport.map((s) => ({
      id: s.report.id,
      sessionId: s.id,
      createdAt: s.report.createdAt.toISOString(),
    }))

    const inProgressSession = resume.sessions
      .filter((s) => !s.sessionComplete)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]

    const latestSession = sessionsWithReport.length > 0
      ? sessionsWithReport.reduce((a, b) => b.report.createdAt > a.report.createdAt ? b : a)
      : null

    return {
      id: resume.id,
      createdAt: resume.createdAt.toISOString(),
      fileName: resume.fileName ?? `자소서 (${resume.createdAt.toLocaleDateString('ko-KR')})`,
      sessionCount: resume.sessions.length,
      hasReport: reportSession !== undefined,
      reportId: reportSession?.report?.id ?? null,
      hasDiagnosis: resume.diagnosisResult !== null,
      inProgressSessionId: inProgressSession?.id ?? null,
      reports,
      ...(latestSession !== null && { latestScore: latestSession.report.totalScore }),
    }
  })

  return NextResponse.json({ resumes: result }, { status: 200 })
}
