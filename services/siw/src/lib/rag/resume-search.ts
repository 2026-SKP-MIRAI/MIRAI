import { ragPrisma } from '@/lib/rag-prisma'
import { isValidEmbeddingVector } from './embedding-client'

export interface AcceptedResumeResult {
  id: string
  jobRole: string
  content: string
  similarity: number
}

/**
 * 임베딩 벡터로 유사 합격 자소서 TOP K 검색
 * ragPrisma.$queryRaw + pgvector cosine similarity
 *
 * @param embedding  baai/bge-m3 벡터 (1024차원)
 * @param jobRole    직무 필터 (없으면 전체 검색)
 * @param topK       반환 최대 개수 (기본 5)
 */
export async function searchSimilarAcceptedResumes(
  embedding: number[],
  jobRole?: string,
  topK = 5
): Promise<AcceptedResumeResult[]> {
  if (!isValidEmbeddingVector(embedding)) return []

  const vectorStr = `[${embedding.join(',')}]`

  const results = jobRole
    ? await ragPrisma.$queryRaw<Array<{
        id: string; job_role: string; content: string; similarity: number
      }>>`
        WITH q AS (SELECT ${vectorStr}::vector AS qvec)
        SELECT id, job_role, content,
               1 - (embedding <=> q.qvec) AS similarity
        FROM accepted_resume_embeddings, q
        WHERE job_role = ${jobRole}
        ORDER BY embedding <=> q.qvec
        LIMIT ${topK}
      `
    : await ragPrisma.$queryRaw<Array<{
        id: string; job_role: string; content: string; similarity: number
      }>>`
        WITH q AS (SELECT ${vectorStr}::vector AS qvec)
        SELECT id, job_role, content,
               1 - (embedding <=> q.qvec) AS similarity
        FROM accepted_resume_embeddings, q
        ORDER BY embedding <=> q.qvec
        LIMIT ${topK}
      `

  return results.map((r) => ({
    id: r.id,
    jobRole: r.job_role,
    content: r.content,
    similarity: Number(r.similarity),
  }))
}
