import { callEnginePracticeFeedback } from '@/lib/engine-client'
import { PracticeFeedbackResponseSchema } from '@/domain/interview/schemas'

export const runtime = 'nodejs'
export const maxDuration = 45

export async function POST(req: Request) {
  let body: { question?: string; answer?: string; previousAnswer?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const { question, answer, previousAnswer } = body

  if (typeof question !== 'string' || !question.trim()) {
    return Response.json({ error: 'question과 answer가 필요합니다.' }, { status: 400 })
  }
  if (typeof answer !== 'string' || !answer.trim()) {
    return Response.json({ error: 'question과 answer가 필요합니다.' }, { status: 400 })
  }

  let engineRes: Response
  try {
    engineRes = await callEnginePracticeFeedback(
      question.trim(),
      answer.trim(),
      previousAnswer?.trim() || undefined
    )
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

  const parsed = PracticeFeedbackResponseSchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  return Response.json(parsed.data, { status: 200 })
}
