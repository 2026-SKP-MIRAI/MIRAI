import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { HistoryItem, QueueItem, PersonaType, QuestionType } from '@/lib/types'

export const maxDuration = 35

const ENGINE_FETCH_TIMEOUT_MS = 55_000

export async function POST(request: NextRequest) {
  let body: { sessionId?: string; answer?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청을 읽을 수 없습니다.' }, { status: 400 })
  }

  const { sessionId, answer } = body

  if (!sessionId || answer === undefined) {
    return NextResponse.json({ error: 'sessionId와 answer가 필요합니다.' }, { status: 400 })
  }

  // Validate answer before DB lookup (avoid unnecessary round-trip)
  if (!answer.trim()) {
    return NextResponse.json({ error: '답변을 입력해 주세요.' }, { status: 400 })
  }

  // Fetch session
  let session: {
    id: string
    resumeId: string
    currentQuestion: string
    currentPersona: string
    currentPersonaLabel: string
    currentQuestionType: string
    sessionComplete: boolean
    history: unknown
    questionsQueue: unknown
    updatedAt: Date
  } | null
  try {
    session = await prisma.interviewSession.findUnique({ where: { id: sessionId } })
  } catch (err) {
    console.error('[interview/answer] session lookup failed', { sessionId, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!session) {
    return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
  }

  if (session.sessionComplete) {
    return NextResponse.json({ error: '이미 완료된 면접 세션입니다.' }, { status: 400 })
  }

  let resume: { resumeText: string } | null
  try {
    resume = await prisma.resume.findUnique({ where: { id: session.resumeId } })
  } catch (err) {
    console.error('[interview/answer] resume lookup failed', { sessionId, resumeId: session.resumeId, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!resume) {
    return NextResponse.json({ error: '자소서를 찾을 수 없습니다.' }, { status: 404 })
  }

  type StoredHistoryEntry = HistoryItem & { questionType?: string }
  const history = session.history as unknown as StoredHistoryEntry[]
  const questionsQueue = session.questionsQueue as unknown as QueueItem[]

  // Trim and enforce engine contract (max 5000 chars)
  const trimmedAnswer = answer.trim().slice(0, 5000)

  const engineUrl = process.env.ENGINE_BASE_URL
  if (!engineUrl) {
    return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
  }

  let engineResponse: Response
  try {
    engineResponse = await fetch(`${engineUrl}/api/interview/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resumeText: resume.resumeText,
        history: history.map(({ questionType: _qt, ...rest }) => rest),
        questionsQueue,
        currentQuestion: session.currentQuestion,
        currentPersona: session.currentPersona,
        currentAnswer: trimmedAnswer,
      }),
      signal: AbortSignal.timeout(ENGINE_FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    console.error('[interview/answer] engine fetch failed', { sessionId, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  let engineData: {
    nextQuestion: { persona: PersonaType; personaLabel: string; question: string; type: QuestionType } | null
    updatedQueue: QueueItem[]
    sessionComplete: boolean
  }
  try {
    engineData = await engineResponse.json()
  } catch (err) {
    console.error('[interview/answer] engine response parse failed', { sessionId, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!engineResponse.ok) {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  const { nextQuestion, updatedQueue, sessionComplete } = engineData

  // Update session
  const newHistoryEntry: StoredHistoryEntry = {
    persona: session.currentPersona as HistoryItem['persona'],
    personaLabel: session.currentPersonaLabel,
    question: session.currentQuestion,
    answer: trimmedAnswer,
    questionType: session.currentQuestionType,
  }
  const updatedHistory = [...history, newHistoryEntry]

  try {
    await prisma.interviewSession.update({
      where: { id: sessionId, sessionComplete: false, updatedAt: session.updatedAt },
      data: {
        history: updatedHistory as object[],
        questionsQueue: updatedQueue as object[],
        sessionComplete,
        ...(nextQuestion
          ? {
              currentQuestion: nextQuestion.question,
              currentPersona: nextQuestion.persona,
              currentPersonaLabel: nextQuestion.personaLabel,
              currentQuestionType: nextQuestion.type,
            }
          : {}),
      },
    })
  } catch (err) {
    // P2025: record not found — concurrent request already completed the session
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: '이미 완료된 면접 세션입니다.' }, { status: 400 })
    }
    console.error('[interview/answer] session update failed', { sessionId, err })
    return NextResponse.json({ error: '세션 업데이트에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ nextQuestion, sessionComplete }, { status: 200 })
}
