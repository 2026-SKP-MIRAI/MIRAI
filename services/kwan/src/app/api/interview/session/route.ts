import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth-context'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { user, userId, isGuest } = await getAuthContext()
  if (!user && !isGuest) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) {
    return Response.json({ error: 'sessionId가 필요합니다.' }, { status: 400 })
  }

  let session: Awaited<ReturnType<typeof prisma.interviewSession.findUnique>>
  try {
    session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
    })
  } catch (err) {
    console.error('[interview/session] DB lookup failed', { err })
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!session) {
    return Response.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (session.userId && session.userId !== userId) {
    return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  return Response.json({
    sessionId: session.id,
    history: session.history,
    currentQuestion: session.currentQuestion,
    currentPersona: session.currentPersona,
    currentPersonaLabel: session.currentPersonaLabel,
    currentQuestionType: session.currentQuestionType,
    sessionComplete: session.sessionComplete,
    interviewMode: session.interviewMode,
  }, { status: 200 })
}
