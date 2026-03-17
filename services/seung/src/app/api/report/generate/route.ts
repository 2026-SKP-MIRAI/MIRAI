import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { StoredHistoryEntry, AxisScores, AxisFeedback } from '@/lib/types'

export const maxDuration = 100

const ENGINE_FETCH_TIMEOUT_MS = 90_000

export async function POST(request: NextRequest) {
  let body: { sessionId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청을 읽을 수 없습니다.' }, { status: 400 })
  }

  const { sessionId } = body

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId가 필요합니다.' }, { status: 400 })
  }

  const engineUrl = process.env.ENGINE_BASE_URL
  if (!engineUrl) {
    return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
  }

  let session: {
    id: string
    sessionComplete: boolean
    history: unknown
    resume: { resumeText: string }
  } | null
  try {
    session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { resume: { select: { resumeText: true } } },
    })
  } catch (err) {
    console.error('[report/generate] session lookup failed', { sessionId, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!session) {
    return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
  }

  if (!session.sessionComplete) {
    return NextResponse.json({ error: '면접이 아직 완료되지 않았습니다.' }, { status: 400 })
  }

  // 이미 생성된 리포트가 있으면 재사용
  let existingReport: { id: string } | null
  try {
    existingReport = await prisma.report.findFirst({ where: { sessionId } })
  } catch (err) {
    console.error('[report/generate] report findFirst failed', { sessionId, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (existingReport) {
    return NextResponse.json({ reportId: existingReport.id }, { status: 200 })
  }

  // history에서 questionType 제거 후 엔진 전달
  const rawHistory = session.history
  if (!Array.isArray(rawHistory)) {
    console.error('[report/generate] session.history is not an array', { sessionId })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
  const history = (rawHistory as StoredHistoryEntry[]).map(
    ({ questionType: _qt, ...rest }) => rest
  )

  let engineResponse: Response
  try {
    engineResponse = await fetch(`${engineUrl}/api/report/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resumeText: session.resume.resumeText,
        history,
      }),
      signal: AbortSignal.timeout(ENGINE_FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    console.error('[report/generate] engine fetch failed', { sessionId, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!engineResponse.ok) {
    if (engineResponse.status === 422) {
      return NextResponse.json(
        { error: '답변이 부족합니다. 더 많은 질문에 답변해 주세요.' },
        { status: 422 }
      )
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  let engineData: {
    totalScore: number
    scores: AxisScores
    summary: string
    axisFeedbacks: AxisFeedback[]
  }
  try {
    engineData = await engineResponse.json()
  } catch (err) {
    console.error('[report/generate] engine response parse failed', { sessionId, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  const totalScore = Math.round(engineData.totalScore)

  try {
    const report = await prisma.report.create({
      data: {
        sessionId,
        totalScore,
        scores: engineData.scores as object,
        summary: engineData.summary,
        axisFeedbacks: engineData.axisFeedbacks as object[],
      },
    })
    return NextResponse.json({ reportId: report.id }, { status: 201 })
  } catch (err) {
    // P2002: sessionId unique constraint — 동시 요청으로 이미 생성됨
    if ((err as { code?: string }).code === 'P2002') {
      try {
        const fallback = await prisma.report.findUnique({ where: { sessionId } })
        if (fallback) {
          return NextResponse.json({ reportId: fallback.id }, { status: 200 })
        }
      } catch (fallbackErr) {
        console.error('[report/generate] P2002 fallback findUnique failed', { sessionId, fallbackErr })
      }
    }
    console.error('[report/generate] report create failed', { sessionId, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
