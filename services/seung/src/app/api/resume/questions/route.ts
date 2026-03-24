import { NextRequest, NextResponse } from 'next/server'
import { callEngineAnalyze, callEngineQuestions } from '@/lib/engine-client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 80

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: '요청을 읽을 수 없습니다.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: '파일을 선택해 주세요.' }, { status: 400 })
  }

  if (!process.env.ENGINE_BASE_URL) {
    return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
  }

  // Step 1: Analyze PDF via engine (extract text + targetRole)
  let analyzeRes: Response
  try {
    analyzeRes = await callEngineAnalyze(file)
  } catch (err) {
    console.error('[resume/questions] engine analyze fetch failed', { err })
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }

  let analyzeData: unknown
  try {
    analyzeData = await analyzeRes.json()
  } catch (err) {
    console.error('[resume/questions] analyze response parse failed', { err })
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }

  if (!analyzeRes.ok) {
    return NextResponse.json(analyzeData, { status: analyzeRes.status })
  }

  const resumeText = (analyzeData as { resumeText?: unknown }).resumeText
  if (typeof resumeText !== 'string' || !resumeText.trim()) {
    console.error('[resume/questions] analyze response missing resumeText', { analyzeData })
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }

  const rawTargetRole = (analyzeData as { targetRole?: unknown }).targetRole
  const targetRole =
    typeof rawTargetRole === 'string' && rawTargetRole.trim() && rawTargetRole !== '미지정'
      ? rawTargetRole
      : undefined

  // Step 2: questions + DB save in parallel
  let engineResponse: Response
  let resumeId: string | null = null
  try {
    const [qRes, resume] = await Promise.all([
      callEngineQuestions(resumeText, targetRole),
      // questions: []로 먼저 저장해 /questions 호출과 병렬 처리.
      // Resume.questions는 downstream(interview/start, feedback)에서 읽지 않으므로 빈 배열로 유지됨.
      prisma.resume.create({ data: { resumeText, questions: [], userId: user.id, fileName: file.name } }).catch((err: unknown) => {
        console.error('[resume/questions] DB save failed', { err })
        return null
      }),
    ])
    engineResponse = qRes
    resumeId = resume?.id ?? null
  } catch (err) {
    console.error('[resume/questions] engine questions fetch failed', { err })
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }

  let data: unknown
  try {
    data = await engineResponse.json()
  } catch (err) {
    console.error('[resume/questions] questions response parse failed', { err })
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }

  if (!engineResponse.ok) {
    return NextResponse.json(data, { status: engineResponse.status })
  }

  const questions = (data as Record<string, unknown>)?.questions
  if (!Array.isArray(questions)) {
    return NextResponse.json(
      { error: '엔진 응답이 올바르지 않습니다.' },
      { status: 502 }
    )
  }

  return NextResponse.json({ ...(data as object), resumeId }, { status: 200 })
}
