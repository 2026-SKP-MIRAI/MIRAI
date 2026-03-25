import { NextRequest, NextResponse } from 'next/server'
import { callEngineFeedback } from '@/lib/engine-client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { embedText } from '@/lib/rag/embedding-client'
import { searchSimilarAcceptedResumes } from '@/lib/rag/resume-search'

export const maxDuration = 45

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const rlResult = rateLimit(`${user.id}:resume/feedback`, 10, 60_000)
  if (rlResult !== true) {
    return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429, headers: { 'Retry-After': String(rlResult) } })
  }

  let body: { resumeId?: string; targetRole?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청을 읽을 수 없습니다.' }, { status: 400 })
  }

  const { resumeId, targetRole } = body

  if (!resumeId) {
    return NextResponse.json({ error: 'resumeId가 필요합니다.' }, { status: 400 })
  }
  const trimmedRole = targetRole?.trim()
  if (!trimmedRole) {
    return NextResponse.json({ error: 'targetRole이 필요합니다.' }, { status: 400 })
  }

  if (!process.env.ENGINE_BASE_URL) {
    return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
  }

  let resume: { id: string; userId: string | null; resumeText: string; diagnosisResult: unknown } | null
  try {
    resume = await prisma.resume.findUnique({ where: { id: resumeId } })
  } catch (err) {
    console.error('[resume/feedback] findUnique failed', { resumeId, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!resume) {
    return NextResponse.json({ error: '이력서를 찾을 수 없습니다.' }, { status: 404 })
  }

  if (resume.userId !== user.id) {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  let resumeContext: string[] | undefined
  if (process.env.ENABLE_RAG === 'true' && process.env.RAG_DATABASE_URL) {
    try {
      const embedding = await embedText(resume.resumeText)
      if (embedding) {
        const hits = await searchSimilarAcceptedResumes(embedding.vector, trimmedRole, 5)
        resumeContext = hits.map((r) => r.content)
      }
    } catch (err) {
      console.error('[resume/feedback] RAG pipeline failed, degrading', { err })
    }
  }

  let engineResponse: Response
  try {
    engineResponse = resumeContext
      ? await callEngineFeedback(resume.resumeText, trimmedRole, resumeContext)
      : await callEngineFeedback(resume.resumeText, trimmedRole)
  } catch (err) {
    console.error('[resume/feedback] engine fetch failed', { err })
    if ((err as { name?: string }).name === 'TimeoutError') {
      return NextResponse.json({ error: '응답이 지연되고 있습니다. 다시 시도해주세요.' }, { status: 504 })
    }
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }

  let data: unknown
  try {
    data = await engineResponse.json()
  } catch (err) {
    console.error('[resume/feedback] engine response parse failed', { err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!engineResponse.ok) {
    const safeMessage =
      typeof data === 'object' &&
      data !== null &&
      'detail' in data &&
      typeof (data as Record<string, unknown>).detail === 'string'
        ? ((data as Record<string, unknown>).detail as string)
        : '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
    return NextResponse.json({ error: safeMessage }, { status: engineResponse.status })
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    console.error('[resume/feedback] unexpected engine response shape', { data })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  try {
    await prisma.resume.update({
      where: { id: resumeId },
      data: { diagnosisResult: data as object },
    })
  } catch (err) {
    console.error('[resume/feedback] DB update failed', { err })
    // 저장 실패해도 결과는 반환
  }

  return NextResponse.json(data, { status: 200 })
}
