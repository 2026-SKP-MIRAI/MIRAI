import { prisma } from '@/lib/db'
import { callEngineAnswer } from '@/lib/engine-client'
import { HistoryItemSchema, QueueItemSchema, EngineAnswerResponseSchema } from '@/domain/interview/schemas'
import type { PersonaType, HistoryItem } from '@/domain/interview/types'

// TODO(#9): engine 성공 → DB 실패 시 재시도하면 엔진 중복 호출 발생 (맥락 꼬임)
// 수정 시점: 실사용자 오픈 전 QA 단계. 해결책: pendingResult 컬럼으로 엔진 응답 임시 저장 후 재시도 감지

export const runtime = 'nodejs'
export const maxDuration = 35

export async function POST(req: Request) {
  let body: { sessionId?: string; answer?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const { sessionId, answer } = body
  if (!sessionId || !answer?.trim()) {
    return Response.json({ error: 'sessionId와 answer가 필요합니다.' }, { status: 400 })
  }

  const trimmedAnswer = answer.trim().slice(0, 5000)

  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: { resume: true },
  })
  if (!session) {
    return Response.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
  }

  if (session.sessionComplete) {
    return Response.json({ error: '이미 완료된 면접 세션입니다.' }, { status: 400 })
  }

  const historyParse = HistoryItemSchema.array().safeParse(session.history)
  if (!historyParse.success) {
    return Response.json({ error: '세션 데이터가 올바르지 않습니다.' }, { status: 500 })
  }
  const queueParse = QueueItemSchema.array().safeParse(session.questionsQueue)
  if (!queueParse.success) {
    return Response.json({ error: '세션 데이터가 올바르지 않습니다.' }, { status: 500 })
  }
  const history = historyParse.data
  const questionsQueue = queueParse.data
  const historyForEngine = history.map(({ questionType: _, ...item }) => item)

  let engineRes: Response
  try {
    engineRes = await callEngineAnswer({
      resumeText: session.resume.resumeText.slice(0, 16000),
      history: historyForEngine,
      questionsQueue,
      currentQuestion: session.currentQuestion,
      currentPersona: session.currentPersona as PersonaType,
      currentAnswer: trimmedAnswer,
    })
  } catch (error) {
    const isTimeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    const msg = isTimeout
      ? '요청 시간이 초과됐습니다. 잠시 후 다시 시도해주세요.'
      : '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    return Response.json({ error: msg }, { status: 500 })
  }

  const engineData = await engineRes.json().catch(() => ({ error: '서버 오류가 발생했습니다.' }))
  if (!engineRes.ok) {
    const msg = engineData.detail ?? '답변 처리 중 오류가 발생했습니다.'
    return Response.json({ error: msg }, { status: engineRes.status })
  }

  const engineParse = EngineAnswerResponseSchema.safeParse(engineData)
  if (!engineParse.success) {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
  const { nextQuestion, updatedQueue, sessionComplete } = engineParse.data

  const newHistoryItem: HistoryItem = {
    persona: session.currentPersona as PersonaType,
    personaLabel: session.currentPersonaLabel || session.currentPersona,
    question: session.currentQuestion,
    answer: trimmedAnswer,
    questionType: session.currentQuestionType as 'main' | 'follow_up',
  }

  try {
    await prisma.interviewSession.update({
      where: { id: sessionId, sessionComplete: false },
      data: {
        history: [...history, newHistoryItem] as object[],
        questionsQueue: updatedQueue as object[],
        currentQuestion: nextQuestion?.question ?? '',
        currentPersona: nextQuestion?.persona ?? '',
        currentPersonaLabel: nextQuestion?.personaLabel ?? '',
        currentQuestionType: nextQuestion?.type ?? 'main',
        sessionComplete,
      },
    })
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') {
      return Response.json({ error: '이미 완료된 면접 세션입니다.' }, { status: 400 })
    }
    throw err
  }

  return Response.json({ nextQuestion, sessionComplete }, { status: 200 })
}
