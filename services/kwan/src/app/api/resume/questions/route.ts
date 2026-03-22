import { callEngineAnalyze, callEngineQuestions } from '@/lib/engine-client'
import { uploadResumePdf } from '@/lib/resume-storage'
import { prisma } from '@/lib/db'
import { EngineAnalyzeResponseSchema, EngineQuestionsResponseSchema } from '@/domain/interview/schemas'

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

  const userTargetRole = formData.get('targetRole')
  const confirmedTargetRole = typeof userTargetRole === 'string' && userTargetRole.trim()
    ? userTargetRole.trim()
    : null

  // 기존 resumeId가 제공된 경우 (Task 4.5 백그라운드 재호출): analyze 생략하고 기존 row 업데이트
  const existingResumeId = formData.get('resumeId')
  if (typeof existingResumeId === 'string' && existingResumeId && confirmedTargetRole) {
    const existing = await prisma.resume.findUnique({ where: { id: existingResumeId } }).catch(() => null)
    if (existing) {
      let qRes: Response
      try {
        qRes = await callEngineQuestions(existing.resumeText, confirmedTargetRole)
      } catch {
        return Response.json({}, { status: 200 }) // 백그라운드 재호출 실패는 무시
      }
      if (qRes.ok) {
        const qRaw = await qRes.json().catch(() => null)
        const qParse = qRaw ? EngineQuestionsResponseSchema.safeParse(qRaw) : null
        if (qParse?.success) {
          void prisma.resume
            .update({ where: { id: existingResumeId }, data: { questions: qParse.data as object } })
            .catch(() => {})
        }
      }
      return Response.json({}, { status: 200 })
    }
  }

  // buffer 먼저 추출 — engine FormData 직렬화 후 arrayBuffer() 이중 소비 방지
  const buffer = Buffer.from(await file.arrayBuffer())
  const fileForEngine = new Blob([buffer], { type: file.type })

  // Step 1: engine /analyze로 텍스트 + targetRole 추출
  let analyzeRes: Response
  try {
    analyzeRes = await callEngineAnalyze(fileForEngine)
  } catch (error) {
    console.error('[resume/questions] engine analyze fetch failed', { error })
    const isTimeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    const msg = isTimeout
      ? '요청 시간이 초과됐습니다. 잠시 후 다시 시도해주세요.'
      : '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    return Response.json({ error: msg }, { status: 500 })
  }

  let analyzeData: unknown
  try {
    analyzeData = await analyzeRes.json()
  } catch {
    console.error('[resume/questions] analyze response JSON parse failed')
    return Response.json({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 })
  }

  if (!analyzeRes.ok) {
    const detail = (analyzeData as { detail?: string }).detail
    return Response.json(
      { error: detail ?? '서버 오류가 발생했습니다.' },
      { status: analyzeRes.status },
    )
  }

  const analyzeParse = EngineAnalyzeResponseSchema.safeParse(analyzeData)
  if (!analyzeParse.success) {
    console.error('[resume/questions] analyze response missing resumeText', { analyzeData })
    return Response.json({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 })
  }

  const { resumeText, targetRole: analyzedTargetRole } = analyzeParse.data
  const effectiveTargetRole = confirmedTargetRole ?? (analyzedTargetRole?.trim() ?? '')

  // Step 2: questions + DB 저장 병렬
  let engineRes: Response
  let resumeId: string | null = null
  try {
    const [qRes, resume] = await Promise.all([
      callEngineQuestions(resumeText, effectiveTargetRole),
      prisma.resume.create({
        data: {
          resumeText,
          questions: [],
          inferredTargetRole: effectiveTargetRole || null,
        },
      }).catch((err: unknown) => {
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

  // PDF 저장 — fire-and-forget (결과와 무관)
  if (resumeId) {
    void uploadResumePdf(buffer, file.name)
      .then((storageKey) =>
        prisma.resume.update({ where: { id: resumeId! }, data: { storageKey } })
      )
      .catch((err) => {
        console.error('[resume/questions] PDF upload or storageKey update failed', { err })
      })
  }

  // Step 3: /questions 응답 처리 (questions DB 저장 포함)
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

  // questions DB 저장 — fire-and-forget (면접 시작 시 questionsQueue 조회를 위해 필요)
  if (resumeId) {
    void prisma.resume
      .update({ where: { id: resumeId }, data: { questions: engineParse.data as object } })
      .catch((err) => console.error('[resume/questions] questions DB update failed', { err }))
  }

  return Response.json(
    { ...engineParse.data, resumeId, inferredTargetRole: effectiveTargetRole || null },
    { status: 200 }
  )
}
