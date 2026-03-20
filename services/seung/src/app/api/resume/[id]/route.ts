import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id } = await params

  let resume: { id: string; userId: string | null } | null
  try {
    resume = await prisma.resume.findUnique({ where: { id }, select: { id: true, userId: true } })
  } catch (err) {
    console.error('[resume/delete] findUnique failed', { id, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!resume) {
    return NextResponse.json({ error: '자소서를 찾을 수 없습니다.' }, { status: 404 })
  }

  if (resume.userId !== user.id) {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  try {
    await prisma.$transaction([
      prisma.report.deleteMany({ where: { session: { resumeId: id } } }),
      prisma.interviewSession.deleteMany({ where: { resumeId: id } }),
      prisma.resume.delete({ where: { id } }),
    ])
  } catch (err) {
    console.error('[resume/delete] transaction failed', { id, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
