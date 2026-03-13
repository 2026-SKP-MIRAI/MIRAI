import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) {
    return Response.json({ error: 'sessionId가 필요합니다.' }, { status: 400 })
  }

  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
  })
  if (!session) {
    return Response.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
  }

  return Response.json({
    sessionId: session.id,
    history: session.history,
    currentQuestion: session.currentQuestion,
    currentPersona: session.currentPersona,
    currentPersonaLabel: session.currentPersonaLabel,
    currentQuestionType: session.currentQuestionType,
    sessionComplete: session.sessionComplete,
  }, { status: 200 })
}
