/**
 * embedding-client.ts
 * RAG 파이프라인을 위한 텍스트 임베딩 클라이언트
 *
 * ENABLE_RAG=true 환경 변수가 설정된 경우에만 실제 호출을 수행한다.
 */

const ENGINE_BASE_URL = process.env.ENGINE_BASE_URL ?? 'http://localhost:8000'

export type EmbeddingVector = number[]

export type EmbeddingResult = {
  vector: EmbeddingVector
  model: string
  tokenCount: number
}

/**
 * 텍스트를 임베딩 벡터로 변환한다.
 * ENABLE_RAG=true 일 때만 실제 엔진 /api/embed 호출을 수행한다.
 */
export async function embedText(text: string): Promise<EmbeddingResult | null> {
  if (process.env.ENABLE_RAG !== 'true') return null

  const resp = await fetch(`${ENGINE_BASE_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts: [text] }),
    signal: AbortSignal.timeout(15000),
  })

  if (!resp.ok) return null

  const data = await resp.json().catch(() => null)
  if (!data?.embeddings?.[0]) return null

  return {
    vector: data.embeddings[0],
    model: data.model ?? 'unknown',
    tokenCount: 0,
  }
}
