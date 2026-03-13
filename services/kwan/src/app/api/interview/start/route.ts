import { prisma } from '@/lib/db'
import { callEngineStart } from '@/lib/engine-client'
import { EngineStartResponseSchema } from '@/domain/interview/schemas'

export const runtime = 'nodejs'
export const maxDuration = 35

export async function POST(req: Request) {
  let body: { resumeId?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const { resumeId } = body
  if (!resumeId) {
    return Response.json({ error: 'resumeId가 필요합니다.' }, { status: 400 })
  }

  const resume = await prisma.resume.findUnique({ where: { id: resumeId } })
  if (!resume) {
    return Response.json({ error: '자소서를 찾을 수 없습니다.' }, { status: 404 })
  }
  let engineRes: Response
  try {
    engineRes = await callEngineStart({
      resumeText: resume.resumeText.slice(0, 16000),
      personas: ['hr', 'tech_lead', 'executive'],
      mode: 'panel',
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
    const msg = engineData.detail ?? '면접 시작 중 오류가 발생했습니다.'
    return Response.json({ error: msg }, { status: engineRes.status })
  }

  const engineParse = EngineStartResponseSchema.safeParse(engineData)
  if (!engineParse.success) {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
  const { firstQuestion, questionsQueue } = engineParse.data

  const session = await prisma.interviewSession.create({
    data: {
      resumeId,
      questionsQueue: questionsQueue as object[],
      history: [],
      currentQuestion: firstQuestion.question,
      currentPersona: firstQuestion.persona,
      currentPersonaLabel: firstQuestion.personaLabel,
      currentQuestionType: firstQuestion.type,
      sessionComplete: false,
    },
  })

  return Response.json({ sessionId: session.id, firstQuestion }, { status: 200 })
}
