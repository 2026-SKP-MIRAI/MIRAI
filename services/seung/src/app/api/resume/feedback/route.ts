import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 45

const ENGINE_FETCH_TIMEOUT_MS = 40_000

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
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
  if (!targetRole || !targetRole.trim()) {
    return NextResponse.json({ error: 'targetRole이 필요합니다.' }, { status: 400 })
  }

  const engineUrl = process.env.ENGINE_BASE_URL
  if (!engineUrl) {
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

  let engineResponse: Response
  try {
    engineResponse = await fetch(`${engineUrl}/api/resume/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText: resume.resumeText, targetRole: targetRole.trim() }),
      signal: AbortSignal.timeout(ENGINE_FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    console.error('[resume/feedback] engine fetch failed', { err })
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
      data: { diagnosisResult: data as Prisma.InputJsonValue },
    })
  } catch (err) {
    console.error('[resume/feedback] DB update failed', { err })
    // 저장 실패해도 결과는 반환
  }

  return NextResponse.json(data, { status: 200 })
}
