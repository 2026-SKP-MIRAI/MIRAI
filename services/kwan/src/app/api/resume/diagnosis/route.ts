import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth-context'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { user, userId, isGuest } = await getAuthContext()
  if (!user && !isGuest) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const resumeId = searchParams.get('resumeId')
  if (!resumeId) {
    return Response.json({ error: 'resumeId가 필요합니다.' }, { status: 400 })
  }

  let resume: { diagnosisResult: unknown; userId: string | null } | null
  try {
    resume = await prisma.resume.findUnique({ where: { id: resumeId } })
  } catch (err) {
    console.error('[resume/diagnosis] DB lookup failed', { err })
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!resume) {
    return Response.json({ error: '자소서를 찾을 수 없습니다.' }, { status: 404 })
  }
  if (resume.userId && resume.userId !== userId) {
    return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }
  if (!resume.diagnosisResult) {
    return Response.json({ error: '진단 결과가 없습니다.' }, { status: 404 })
  }

  return Response.json(resume.diagnosisResult, { status: 200 })
}
