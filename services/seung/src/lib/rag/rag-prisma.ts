import { PrismaClient } from '@prisma/client'

// RAG 전용 Prisma 클라이언트 — 공용 Supabase (RAG_DATABASE_URL)
// 개인 DATABASE_URL(user data)과 분리: accepted_resume_embeddings
const globalForRagPrisma = globalThis as unknown as { ragPrisma: PrismaClient | undefined }

// RAG_DATABASE_URL 미설정 시 기본 PrismaClient로 fallback (ENABLE_RAG guard가 실제 쿼리 차단)
export const ragPrisma =
  globalForRagPrisma.ragPrisma ??
  new PrismaClient(
    process.env.RAG_DATABASE_URL
      ? { datasources: { db: { url: process.env.RAG_DATABASE_URL } } }
      : undefined
  )

if (process.env.NODE_ENV !== 'production') {
  globalForRagPrisma.ragPrisma = ragPrisma
}
