import { PrismaClient } from '@prisma/client'

const globalForRagPrisma = globalThis as unknown as { ragPrisma: PrismaClient | undefined }

// RAG_DATABASE_URL 미설정 시 null — 불필요한 커넥션 풀 방지
export const ragPrisma: PrismaClient | null = (() => {
  if (!process.env.RAG_DATABASE_URL) return null
  if (globalForRagPrisma.ragPrisma) return globalForRagPrisma.ragPrisma
  const client = new PrismaClient({ datasources: { db: { url: process.env.RAG_DATABASE_URL } } })
  if (process.env.NODE_ENV !== 'production') globalForRagPrisma.ragPrisma = client
  return client
})()
