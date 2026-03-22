import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const resumeId = searchParams.get('resumeId')
  if (!resumeId) {
    return Response.json({ error: 'resumeId가 필요합니다.' }, { status: 400 })
  }

  let resume: { diagnosisResult: unknown } | null
  try {
    resume = await prisma.resume.findUnique({ where: { id: resumeId } })
  } catch (err) {
    console.error('[resume/diagnosis] DB lookup failed', { err })
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!resume) {
    return Response.json({ error: '자소서를 찾을 수 없습니다.' }, { status: 404 })
  }
  if (!resume.diagnosisResult) {
    return Response.json({ error: '진단 결과가 없습니다.' }, { status: 404 })
  }

  return Response.json(resume.diagnosisResult, { status: 200 })
}
