import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic' // 항상 fresh 응답 — ALB 헬스체크 캐시 방지

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return Response.json({ status: 'ok' })
  } catch {
    return Response.json({ status: 'error', message: 'DB connection failed' }, { status: 503 })
  }
}
