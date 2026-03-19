import { NextRequest, NextResponse } from 'next/server'
import { callEngineParse, callEngineQuestions } from '@/lib/engine-client'
import { prisma } from '@/lib/prisma'

export const maxDuration = 60

export async function POST(request: NextRequest) {
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

  // Step 1: Parse PDF via engine
  let parseRes: Response
  try {
    parseRes = await callEngineParse(file)
  } catch (err) {
    console.error('[resume/questions] engine parse fetch failed', { err })
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }

  let parseData: unknown
  try {
    parseData = await parseRes.json()
  } catch (err) {
    console.error('[resume/questions] parse response parse failed', { err })
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }

  if (!parseRes.ok) {
    return NextResponse.json(parseData, { status: parseRes.status })
  }

  const resumeText = (parseData as { resumeText?: unknown }).resumeText
  if (typeof resumeText !== 'string' || !resumeText) {
    console.error('[resume/questions] parse response missing resumeText', { parseData })
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }

  // Step 2: questions + DB save in parallel
  let engineResponse: Response
  let resumeId: string | null = null
  try {
    const [qRes, resume] = await Promise.all([
      callEngineQuestions(resumeText),
      prisma.resume.create({ data: { resumeText, questions: [] } }).catch((err) => {
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
