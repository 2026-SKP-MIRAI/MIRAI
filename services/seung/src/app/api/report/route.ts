import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { AxisScores, AxisFeedback } from '@/lib/types'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const reportId = request.nextUrl.searchParams.get('reportId')

  if (!reportId) {
    return NextResponse.json({ error: 'reportId가 필요합니다.' }, { status: 400 })
  }

  let report: {
    id: string
    userId: string | null
    sessionId: string
    totalScore: number
    scores: unknown
    summary: string
    axisFeedbacks: unknown
    createdAt: Date
  } | null
  try {
    report = await prisma.report.findUnique({ where: { id: reportId } })
  } catch (err) {
    console.error('[report] findUnique failed', { reportId, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!report) {
    return NextResponse.json({ error: '리포트를 찾을 수 없습니다.' }, { status: 404 })
  }

  if (report.userId !== user.id) {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  return NextResponse.json(
    {
      id: report.id,
      sessionId: report.sessionId,
      totalScore: report.totalScore,
      scores: report.scores as AxisScores,
      summary: report.summary,
      axisFeedbacks: report.axisFeedbacks as AxisFeedback[],
      createdAt: report.createdAt.toISOString(),
    },
    { status: 200 }
  )
}
