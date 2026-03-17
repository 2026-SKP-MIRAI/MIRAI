import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { HistoryItem } from '@/lib/types'

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId')

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId가 필요합니다.' }, { status: 400 })
  }

  let session: {
    currentQuestion: string
    currentPersona: string
    currentPersonaLabel: string
    currentQuestionType: string
    history: unknown
    sessionComplete: boolean
    interviewMode: string
  } | null
  try {
    session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      select: {
        currentQuestion: true,
        currentPersona: true,
        currentPersonaLabel: true,
        currentQuestionType: true,
        history: true,
        sessionComplete: true,
        interviewMode: true,
      },
    })
  } catch (err) {
    console.error('[interview/session] session lookup failed', { sessionId, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!session) {
    return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
  }

  return NextResponse.json({
    currentQuestion: session.currentQuestion,
    currentPersona: session.currentPersona,
    currentPersonaLabel: session.currentPersonaLabel,
    currentQuestionType: session.currentQuestionType,
    history: session.history as HistoryItem[],
    sessionComplete: session.sessionComplete,
    interviewMode: session.interviewMode,
  })
}
