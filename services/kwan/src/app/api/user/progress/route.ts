export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import type { AxisScores } from '@/domain/interview/types'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  let reports: {
    sessionId: string
    totalScore: number
    scores: unknown
    createdAt: Date
  }[]

  try {
    reports = await prisma.report.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { sessionId: true, totalScore: true, scores: true, createdAt: true },
    })
  } catch (err) {
    console.error('[user/progress] findMany failed', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  const items = reports.map((r, i) => ({
    round: i + 1,
    sessionId: r.sessionId,
    totalScore: r.totalScore,
    scores: r.scores as AxisScores,
    createdAt: r.createdAt.toISOString(),
  }))

  return NextResponse.json({ items }, { status: 200 })
}
