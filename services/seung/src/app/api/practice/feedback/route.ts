import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

export const maxDuration = 45

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const rlResult = rateLimit(`ip:${ip}:practice/feedback`, 20, 60_000)
  if (rlResult !== true) {
    return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429, headers: { 'Retry-After': String(rlResult) } })
  }

  let body: { question?: string; answer?: string; previousAnswer?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청을 읽을 수 없습니다.' }, { status: 400 })
  }

  const { question, answer, previousAnswer } = body

  if (typeof question !== 'string' || question.trim() === '') {
    return NextResponse.json({ error: 'question과 answer가 필요합니다.' }, { status: 400 })
  }

  if (typeof answer !== 'string' || answer.trim() === '') {
    return NextResponse.json({ error: 'question과 answer가 필요합니다.' }, { status: 400 })
  }

  const engineUrl = process.env.ENGINE_BASE_URL
  if (!engineUrl) {
    return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
  }

  let engineResponse: Response
  try {
    engineResponse = await fetch(`${engineUrl}/api/practice/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, answer, ...(previousAnswer ? { previousAnswer } : {}) }),
      signal: AbortSignal.timeout(40_000),
    })
  } catch (err) {
    console.error('[practice/feedback] engine fetch failed', { err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  let engineData: unknown
  try {
    engineData = await engineResponse.json()
  } catch (err) {
    console.error('[practice/feedback] engine response parse failed', { err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: engineResponse.status })
  }

  return NextResponse.json(engineData, { status: engineResponse.status })
}
