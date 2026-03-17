import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { AxisScores, AxisFeedback } from '@/lib/types'

export async function GET(request: NextRequest) {
  const reportId = request.nextUrl.searchParams.get('reportId')

  if (!reportId) {
    return NextResponse.json({ error: 'reportId가 필요합니다.' }, { status: 400 })
  }

  let report: {
    id: string
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
