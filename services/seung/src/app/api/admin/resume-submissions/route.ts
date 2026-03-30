import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

async function assertAdmin(): Promise<{ error: NextResponse } | { adminId: string }> {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) {
    return { error: NextResponse.json({ error: '관리자 설정이 없습니다.' }, { status: 503 }) }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) }
  }
  if (user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return { error: NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 }) }
  }
  return { adminId: user.id }
}

export async function GET(request: NextRequest) {
  const result = await assertAdmin()
  if ('error' in result) return result.error

  const processedParam = request.nextUrl.searchParams.get('processed')
  const where =
    processedParam === 'true' ? { processed: true }
    : processedParam === 'false' ? { processed: false }
    : {}

  try {
    const pageRaw = parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10)
    const page = isNaN(pageRaw) ? 1 : Math.max(1, pageRaw)
    const submissions = await prisma.resumeSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      skip: (page - 1) * 50,
      select: {
        id: true,
        userId: true,
        jobRole: true,
        company: true,
        processed: true,
        createdAt: true,
      },
    })
    return NextResponse.json({ submissions }, { status: 200 })
  } catch (err) {
    console.error('[admin/resume-submissions] findMany failed', { err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const result = await assertAdmin()
  if ('error' in result) return result.error

  const idParam = request.nextUrl.searchParams.get('id')
  const id = idParam ? parseInt(idParam, 10) : NaN
  if (isNaN(id)) {
    return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })
  }

  try {
    await prisma.resumeSubmission.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: '존재하지 않는 제출입니다.' }, { status: 404 })
    }
    console.error('[admin/resume-submissions] delete failed', { id, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
