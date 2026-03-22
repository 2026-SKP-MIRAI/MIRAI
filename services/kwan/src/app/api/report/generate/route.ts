import { callEngineReportGenerate } from '@/lib/engine-client'
import { prisma } from '@/lib/db'
import { ReportGenerateResponseSchema } from '@/domain/interview/schemas'
import type { HistoryItem } from '@/domain/interview/types'

export const runtime = 'nodejs'
export const maxDuration = 100

export async function POST(req: Request) {
  let body: { sessionId?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const { sessionId } = body
  if (!sessionId) {
    return Response.json({ error: 'sessionId가 필요합니다.' }, { status: 400 })
  }

  let session: { sessionComplete: boolean; history: unknown; resume: { resumeText: string } } | null
  try {
    session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { resume: { select: { resumeText: true } } },
    })
  } catch (err) {
    console.error('[report/generate] DB session lookup failed', { err })
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!session) {
    return Response.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (!session.sessionComplete) {
    return Response.json({ error: '면접이 아직 완료되지 않았습니다.' }, { status: 400 })
  }

  const rawHistory = session.history as unknown
  // ① 배열 타입 검사 먼저 → DB 오염 방어
  if (!Array.isArray(rawHistory)) {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
  // ② 길이 검사 → 사용자 피드백
  if (rawHistory.length < 5) {
    return Response.json(
      { error: '답변이 부족합니다. 더 많은 질문에 답변해 주세요.' },
      { status: 422 }
    )
  }
  const typedHistory = rawHistory as HistoryItem[]

  // 멱등성: 기존 리포트 확인
  let existing: { id: string } | null = null
  try {
    existing = await prisma.report.findFirst({ where: { sessionId } })
  } catch (err) {
    console.error('[report/generate] DB report lookup failed', { err })
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
  if (existing) {
    return Response.json({ reportId: existing.id }, { status: 200 })
  }

  // history에서 questionType 제거
  const history = typedHistory.map(({ questionType: _qt, ...rest }) => rest)

  let engineRes: Response
  try {
    engineRes = await callEngineReportGenerate(session.resume.resumeText, history)
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
    return Response.json(
      {
        error: isTimeout
          ? '요청 시간이 초과됐습니다. 잠시 후 다시 시도해주세요.'
          : '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }

  if (!engineRes.ok) {
    if (engineRes.status === 422) {
      return Response.json(
        { error: '답변이 부족합니다. 더 많은 질문에 답변해 주세요.' },
        { status: 422 }
      )
    }
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  let raw: unknown
  try {
    raw = await engineRes.json()
  } catch {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  const parsed = ReportGenerateResponseSchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  try {
    const report = await prisma.report.create({
      data: {
        sessionId,
        totalScore: Math.round(parsed.data.totalScore),
        scores: parsed.data.scores as object,
        summary: parsed.data.summary,
        axisFeedbacks: parsed.data.axisFeedbacks as object[],
      },
    })
    return Response.json({ reportId: report.id }, { status: 201 })
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      const fallback = await prisma.report
        .findUnique({ where: { sessionId } })
        .catch(() => null)
      if (fallback) {
        return Response.json({ reportId: fallback.id }, { status: 200 })
      }
    }
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
