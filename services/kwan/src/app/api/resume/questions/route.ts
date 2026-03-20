import { callEngineParse, callEngineQuestions } from '@/lib/engine-client'
import { prisma } from '@/lib/db'
import { EngineQuestionsResponseSchema } from '@/domain/interview/schemas'

export const runtime = 'nodejs'
export const maxDuration = 70

export async function POST(req: Request) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return Response.json({ error: 'PDF 파일을 선택해주세요.' }, { status: 400 })
  }

  // Step 1: engine /parse로 텍스트 추출
  let parseRes: Response
  try {
    parseRes = await callEngineParse(file)
  } catch (error) {
    console.error('[resume/questions] engine parse fetch failed', { error })
    const isTimeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    const msg = isTimeout
      ? '요청 시간이 초과됐습니다. 잠시 후 다시 시도해주세요.'
      : '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    return Response.json({ error: msg }, { status: 500 })
  }

  let parseData: unknown
  try {
    parseData = await parseRes.json()
  } catch {
    console.error('[resume/questions] parse response JSON parse failed')
    return Response.json({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 })
  }

  if (!parseRes.ok) {
    const detail = (parseData as { detail?: string }).detail
    return Response.json(
      { error: detail ?? '서버 오류가 발생했습니다.' },
      { status: parseRes.status },
    )
  }

  const resumeText = (parseData as { resumeText?: unknown }).resumeText
  if (typeof resumeText !== 'string' || !resumeText.trim()) {
    console.error('[resume/questions] parse response missing resumeText', { parseData })
    return Response.json({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 })
  }

  // Step 2: questions + DB 저장 병렬
  let engineRes: Response
  let resumeId: string | null = null
  try {
    const [qRes, resume] = await Promise.all([
      callEngineQuestions(resumeText),
      // questions: [] — DB save와 /questions 병렬이므로 실제 질문은 아직 없음
      // resume.questions는 downstream(interview/start)에서 읽지 않음 (resumeText만 사용)
      prisma.resume.create({ data: { resumeText, questions: [] } }).catch((err: unknown) => {
        console.error('[resume/questions] DB save failed', { err })
        return null
      }),
    ])
    engineRes = qRes
    resumeId = resume?.id ?? null
  } catch (error) {
    console.error('[resume/questions] engine questions fetch failed', { error })
    const isTimeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    const msg = isTimeout
      ? '요청 시간이 초과됐습니다. 잠시 후 다시 시도해주세요.'
      : '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    return Response.json({ error: msg }, { status: 500 })
  }

  // Step 3: /questions 응답 처리
  let raw: unknown
  try {
    raw = await engineRes.json()
  } catch {
    console.error('[resume/questions] questions response JSON parse failed')
    return Response.json({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 })
  }

  if (!engineRes.ok) {
    const msg = (raw as { detail?: string }).detail ?? '서버 오류가 발생했습니다.'
    return Response.json({ error: msg }, { status: engineRes.status })
  }

  const engineParse = EngineQuestionsResponseSchema.safeParse(raw)
  if (!engineParse.success) {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  return Response.json({ ...engineParse.data, resumeId }, { status: 200 })
}
