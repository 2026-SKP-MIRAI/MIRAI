import { NextRequest, NextResponse } from 'next/server'
import { extractPdfText } from '@/lib/pdf-utils'
import { prisma } from '@/lib/prisma'

export const maxDuration = 35

const ENGINE_FETCH_TIMEOUT_MS = 30_000

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

  const engineUrl = process.env.ENGINE_BASE_URL
  if (!engineUrl) {
    return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
  }

  // Read once as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer()

  // Rebuild File for engine (stream consumed)
  const engineFile = new File([arrayBuffer], file.name, { type: file.type })
  const engineFormData = new FormData()
  engineFormData.append('file', engineFile)

  try {
    // Run engine call + PDF extraction in parallel
    const [engineResponse, resumeText] = await Promise.all([
      fetch(`${engineUrl}/api/resume/questions`, {
        method: 'POST',
        body: engineFormData,
        signal: AbortSignal.timeout(ENGINE_FETCH_TIMEOUT_MS),
      }),
      extractPdfText(arrayBuffer),
    ])

    let data: unknown
    try {
      data = await engineResponse.json()
    } catch (err) {
      console.error('[resume/questions] engine response parse failed', { err })
      return NextResponse.json(
        { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 500 }
      )
    }

    if (!engineResponse.ok) {
      return NextResponse.json(data, { status: engineResponse.status })
    }

    // Save to DB (best-effort — failure does not block response)
    let resumeId: string | null = null
    const questions = (data as Record<string, unknown>)?.questions
    if (!Array.isArray(questions)) {
      return NextResponse.json(
        { error: '엔진 응답이 올바르지 않습니다.' },
        { status: 502 }
      )
    }
    try {
      const resume = await prisma.resume.create({
        data: {
          resumeText,
          questions: questions as object[],
        },
      })
      resumeId = resume.id
    } catch (err) {
      console.error('[resume/questions] DB save failed', { err })
      // continue without resumeId — client will not show "면접 시작"
    }

    return NextResponse.json({ ...(data as object), resumeId }, { status: 200 })
  } catch (err) {
    console.error('[resume/questions] engine fetch failed', { err })
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
