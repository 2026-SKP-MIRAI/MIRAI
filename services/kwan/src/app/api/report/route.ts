import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth-context'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { user, userId, isGuest } = await getAuthContext()
  if (!user && !isGuest) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const reportId = searchParams.get('reportId')
  if (!reportId) {
    return Response.json({ error: 'reportId가 필요합니다.' }, { status: 400 })
  }

  let report: { id: string; sessionId: string; totalScore: number; scores: unknown; summary: string; axisFeedbacks: unknown; createdAt: Date; userId: string | null } | null
  try {
    report = await prisma.report.findUnique({ where: { id: reportId } })
  } catch (err) {
    console.error('[report] DB lookup failed', { err })
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!report) {
    return Response.json({ error: '리포트를 찾을 수 없습니다.' }, { status: 404 })
  }
  if (report.userId && report.userId !== userId) {
    return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  return Response.json({
    id: report.id,
    sessionId: report.sessionId,
    totalScore: report.totalScore,
    scores: report.scores,
    summary: report.summary,
    axisFeedbacks: report.axisFeedbacks,
    createdAt: report.createdAt.toISOString(),
  }, { status: 200 })
}
