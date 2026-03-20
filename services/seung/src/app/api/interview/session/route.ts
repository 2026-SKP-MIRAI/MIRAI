import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { HistoryItem } from '@/lib/types'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const sessionId = request.nextUrl.searchParams.get('sessionId')

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId가 필요합니다.' }, { status: 400 })
  }

  let session: {
    userId: string | null
    currentQuestion: string
    currentPersona: string
    currentPersonaLabel: string
    currentQuestionType: string
    history: unknown
    questionsQueue: unknown
    sessionComplete: boolean
    interviewMode: string
  } | null
  try {
    session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      select: {
        userId: true,
        currentQuestion: true,
        currentPersona: true,
        currentPersonaLabel: true,
        currentQuestionType: true,
        history: true,
        questionsQueue: true,
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

  if (session.userId !== user.id) {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const queue = Array.isArray(session.questionsQueue) ? session.questionsQueue : []
  const historyLen = Array.isArray(session.history) ? (session.history as unknown[]).length : 0
  const totalQuestions = historyLen + queue.length + (session.sessionComplete ? 0 : 1)

  return NextResponse.json({
    currentQuestion: session.currentQuestion,
    currentPersona: session.currentPersona,
    currentPersonaLabel: session.currentPersonaLabel,
    currentQuestionType: session.currentQuestionType,
    history: session.history as HistoryItem[],
    sessionComplete: session.sessionComplete,
    interviewMode: session.interviewMode,
    totalQuestions,
  })
}
