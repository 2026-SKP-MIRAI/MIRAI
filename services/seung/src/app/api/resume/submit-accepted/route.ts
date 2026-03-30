import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { callEngineAnalyze } from '@/lib/engine-client'
import { rateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

// 인증 불필요 — 기여 건수는 공개 정보 (기여 동기 부여용)
export async function GET() {
  try {
    const count = await prisma.resumeSubmission.count()
    return NextResponse.json({ count }, { status: 200 })
  } catch (err) {
    console.error('[resume/submit-accepted] count failed', { err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const rlResult = rateLimit(`${user.id}:resume/submit-accepted`, 10, 24 * 60 * 60_000)
  if (rlResult !== true) {
    return NextResponse.json({ error: '하루 제출 한도(10건)를 초과했습니다.' }, { status: 429, headers: { 'Retry-After': String(rlResult) } })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const file = formData.get('file')
  const jobRole = formData.get('jobRole')
  const company = formData.get('company')
  const consent = formData.get('consent')

  if (!jobRole || typeof jobRole !== 'string' || !jobRole.trim()) {
    return NextResponse.json({ error: '직군을 선택해주세요.' }, { status: 400 })
  }
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'PDF 파일을 업로드해주세요.' }, { status: 400 })
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'PDF 파일만 업로드 가능합니다.' }, { status: 415 })
  }
  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'PDF 파일은 5MB 이하만 업로드 가능합니다.' }, { status: 413 })
  }
  if (consent !== 'true') {
    return NextResponse.json({ error: '동의가 필요합니다.' }, { status: 400 })
  }

  if (!process.env.ENGINE_BASE_URL) {
    return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
  }

  // PDF 텍스트 추출
  let analyzeRes: Response
  try {
    analyzeRes = await callEngineAnalyze(file)
  } catch (err) {
    console.error('[resume/submit-accepted] engine analyze failed', { err })
    if ((err as { name?: string }).name === 'TimeoutError') {
      return NextResponse.json({ error: '응답이 지연되고 있습니다. 다시 시도해주세요.' }, { status: 504 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!analyzeRes.ok) {
    const data = await analyzeRes.json().catch(() => ({}))
    return NextResponse.json(data, { status: analyzeRes.status })
  }

  let analyzeData: unknown
  try {
    analyzeData = await analyzeRes.json()
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  const resumeText = (analyzeData as { resumeText?: unknown }).resumeText
  if (typeof resumeText !== 'string' || !resumeText.trim()) {
    return NextResponse.json({ error: 'PDF에서 텍스트를 읽을 수 없습니다.' }, { status: 422 })
  }

  if (resumeText.length < 200) {
    return NextResponse.json({ error: '자소서 본문은 200자 이상이어야 합니다.' }, { status: 400 })
  }

  try {
    const submission = await prisma.resumeSubmission.create({
      data: {
        userId: user.id,
        jobRole,
        content: resumeText,
        company: typeof company === 'string' && company.trim() ? company.trim() : null,
      },
      select: { id: true, createdAt: true },
    })
    return NextResponse.json(submission, { status: 201 })
  } catch (err) {
    console.error('[resume/submit-accepted] create failed', { err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
