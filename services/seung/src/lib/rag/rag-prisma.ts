import { PrismaClient } from '@prisma/client'

const globalForRagPrisma = globalThis as unknown as { ragPrisma: PrismaClient | undefined }

// RAG_DATABASE_URL 미설정 시 null — 불필요한 커넥션 풀 방지
export const ragPrisma: PrismaClient | null = (() => {
  if (!process.env.RAG_DATABASE_URL) return null
  if (globalForRagPrisma.ragPrisma) return globalForRagPrisma.ragPrisma
  const client = new PrismaClient({ datasources: { db: { url: process.env.RAG_DATABASE_URL } } })
  // 개발 환경에서만 global 캐싱 — Next.js HMR 시 커넥션 풀 고갈 방지 (프로덕션은 재시작 없음)
  if (process.env.NODE_ENV !== 'production') globalForRagPrisma.ragPrisma = client
  return client
})()
