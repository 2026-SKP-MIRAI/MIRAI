import { callEngineResumeFeedback } from '@/lib/engine-client'
import { prisma } from '@/lib/db'
import { ResumeFeedbackResponseSchema } from '@/domain/interview/schemas'

export const runtime = 'nodejs'
export const maxDuration = 45

export async function POST(req: Request) {
  let body: { resumeId?: string; targetRole?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const { resumeId, targetRole } = body
  if (!resumeId) {
    return Response.json({ error: 'resumeId가 필요합니다.' }, { status: 400 })
  }

  let resume: { resumeText: string; inferredTargetRole: string | null } | null
  try {
    resume = await prisma.resume.findUnique({ where: { id: resumeId } })
  } catch (err) {
    console.error('[resume/feedback] DB lookup failed', { err })
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!resume) {
    return Response.json({ error: '자소서를 찾을 수 없습니다.' }, { status: 404 })
  }

  const effectiveTargetRole =
    targetRole?.trim() || resume.inferredTargetRole || '미지정 직무'

  let engineRes: Response
  try {
    engineRes = await callEngineResumeFeedback(resume.resumeText, effectiveTargetRole)
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
    return Response.json(
      {
        error: isTimeout
          ? '요청 시간이 초과됐습니다. 잠시 후 다시 시도해주세요.'
          : '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }

  let raw: unknown
  try {
    raw = await engineRes.json()
  } catch {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!engineRes.ok) {
    const detail = (raw as { detail?: string }).detail
    return Response.json(
      { error: detail ?? '서버 오류가 발생했습니다.' },
      { status: engineRes.status }
    )
  }

  const parsed = ResumeFeedbackResponseSchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  // DB 저장 — await 필수: /diagnosis 접근 전 저장 완료 보장 (실패해도 결과 반환)
  await prisma.resume
    .update({ where: { id: resumeId }, data: { diagnosisResult: raw as object } })
    .catch((err) => {
      console.error('[resume/feedback] DB update failed', { err })
    })

  return Response.json(parsed.data, { status: 200 })
}
