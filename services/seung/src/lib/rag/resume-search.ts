import { Prisma } from '@prisma/client'
import { ragPrisma } from '@/lib/rag/rag-prisma'

export interface AcceptedResumeResult {
  id: string
  jobRole: string
  content: string
  similarity: number
}

export async function searchSimilarAcceptedResumes(
  embedding: number[],
  jobRole?: string,
  topK = 5
): Promise<AcceptedResumeResult[]> {
  if (!ragPrisma) return []

  const vectorStr = `[${embedding.join(',')}]`
  const whereClause = jobRole ? Prisma.sql`WHERE job_role = ${jobRole}` : Prisma.empty

  const results = await ragPrisma.$queryRaw<Array<{
    id: string; job_role: string; content: string; similarity: number
  }>>`
    WITH q AS (SELECT ${vectorStr}::vector AS qvec)
    SELECT id, job_role, content,
           1 - (embedding <=> q.qvec) AS similarity
    FROM accepted_resume_embeddings, q
    ${whereClause}
    ORDER BY embedding <=> q.qvec
    LIMIT ${topK}
  `

  return results.map((r: { id: string; job_role: string; content: string; similarity: number }) => ({
    id: r.id,
    jobRole: r.job_role,
    content: r.content,
    similarity: Number(r.similarity),
  }))
}
