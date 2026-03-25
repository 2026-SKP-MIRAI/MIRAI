export type EmbeddingVector = number[]

export type EmbeddingResult = {
  vector: EmbeddingVector
  model: string
}

export async function embedText(text: string): Promise<EmbeddingResult | null> {
  if (process.env.ENABLE_RAG !== 'true') return null
  if (!text.trim()) return null

  const engineUrl = process.env.ENGINE_BASE_URL
  if (!engineUrl) return null

  const resp = await fetch(`${engineUrl}/api/embed`, {
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
  }
}
