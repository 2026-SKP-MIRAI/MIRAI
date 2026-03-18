import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const resumeId = request.nextUrl.searchParams.get('resumeId')

  if (!resumeId) {
    return NextResponse.json({ error: 'resumeId가 필요합니다.' }, { status: 400 })
  }

  let resume: { id: string; diagnosisResult: unknown } | null
  try {
    resume = await prisma.resume.findUnique({
      where: { id: resumeId },
      select: { id: true, diagnosisResult: true },
    })
  } catch (err) {
    console.error('[resume/diagnosis] findUnique failed', { resumeId, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!resume) {
    return NextResponse.json({ error: '이력서를 찾을 수 없습니다.' }, { status: 404 })
  }

  if (!resume.diagnosisResult) {
    return NextResponse.json({ error: '진단 결과가 없습니다.' }, { status: 404 })
  }

  return NextResponse.json(resume.diagnosisResult, { status: 200 })
}
