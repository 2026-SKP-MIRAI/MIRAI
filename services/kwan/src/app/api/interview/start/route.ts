import { prisma } from '@/lib/db'
import { callEngineStart } from '@/lib/engine-client'
import { EngineStartResponseSchema } from '@/domain/interview/schemas'
import { getAuthContext } from '@/lib/auth-context'

export const runtime = 'nodejs'
export const maxDuration = 45

export async function POST(req: Request) {
  const { user, userId, isGuest } = await getAuthContext()
  if (!user && !isGuest) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  let body: { resumeId?: string; mode?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const { resumeId, mode } = body
  if (!resumeId) {
    return Response.json({ error: 'resumeId가 필요합니다.' }, { status: 400 })
  }

  let resume: { resumeText: string; userId: string | null } | null
  try {
    resume = await prisma.resume.findUnique({ where: { id: resumeId } })
  } catch (err) {
    console.error('[interview/start] DB lookup failed', { err })
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!resume) {
    return Response.json({ error: '자소서를 찾을 수 없습니다.' }, { status: 404 })
  }

  if (resume.userId && resume.userId !== userId) {
    return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
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
    return Response.json({
      error: isTimeout
        ? '요청 시간이 초과됐습니다. 잠시 후 다시 시도해주세요.'
        : '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    }, { status: 500 })
  }

  const engineData = await engineRes.json().catch(() => ({ error: '서버 오류가 발생했습니다.' }))
  if (!engineRes.ok) {
    return Response.json({
      error: (engineData as { detail?: string }).detail ?? '면접 시작 중 오류가 발생했습니다.',
    }, { status: 500 })
  }

  const engineParse = EngineStartResponseSchema.safeParse(engineData)
  if (!engineParse.success) {
    return Response.json({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 })
  }
  const { firstQuestion, questionsQueue } = engineParse.data

  const interviewMode = mode === 'practice' ? 'practice' : 'real'

  let session: { id: string }
  try {
    session = await prisma.interviewSession.create({
      data: {
        userId: userId,
        resumeId,
        questionsQueue: questionsQueue as object[],
        history: [],
        currentQuestion: firstQuestion.question,
        currentPersona: firstQuestion.persona,
        currentPersonaLabel: firstQuestion.personaLabel,
        currentQuestionType: firstQuestion.type,
        sessionComplete: false,
        interviewMode,
      },
    })
  } catch (err) {
    console.error('[interview/start] DB session create failed', { err })
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  return Response.json({ sessionId: session.id, firstQuestion, totalQuestions: questionsQueue.length + 1 }, { status: 200 })
}
