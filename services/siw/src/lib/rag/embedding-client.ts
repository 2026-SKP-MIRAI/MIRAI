/**
 * embedding-client.ts
 * RAG 파이프라인을 위한 텍스트 임베딩 클라이언트
 *
 * ENABLE_RAG=true 환경 변수가 설정된 경우에만 실제 호출을 수행한다.
 * 트렌드 스킬 조회는 vector-search.ts의 getTrendSkillsForRole()로 구현됨 (#163 ADR).
 * fetchTrendSkills()는 embedText()가 null을 반환할 때의 폴백 스텁으로만 유지.
 */

const ENGINE_BASE_URL = process.env.ENGINE_BASE_URL ?? "http://localhost:8000"

export type EmbeddingVector = number[]

export type EmbeddingResult = {
  vector: EmbeddingVector
  model: string
  tokenCount: number
}

/**
 * 텍스트를 임베딩 벡터로 변환한다.
 * ENABLE_RAG가 비활성화된 경우 null을 반환한다.
 * 엔진 POST /api/embed — { texts: string[] } → { embeddings: number[][], model, usage }
 */
export async function embedText(text: string): Promise<EmbeddingResult | null> {
  if (process.env.ENABLE_RAG !== "true") return null

  const resp = await fetch(`${ENGINE_BASE_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts: [text] }),
    signal: AbortSignal.timeout(15000),
  })

  if (!resp.ok) return null

  const data = await resp.json().catch(() => null)
  if (!data?.embeddings?.[0]) return null

  return {
    vector: data.embeddings[0],
    model: data.model ?? "unknown",
    tokenCount: 0,
  }
}

/**
 * 직무 역할에 대한 트렌드 스킬 목록을 조회한다 (폴백 스텁).
 * ENABLE_RAG가 비활성화된 경우 빈 배열을 반환한다.
 * 정상 경로에서는 vector-search.ts의 getTrendSkillsForRole()가 사용됨.
 * embedText()가 null일 때만 이 함수가 호출된다.
 */
export async function fetchTrendSkills(
  role: string,
  topK = 10
): Promise<Array<{ skill: string; weight: number }>> {
  if (process.env.ENABLE_RAG !== "true") return []

  // Pipeline 2-2(#163)에서 엔진 /api/rag/trends 구현 예정
  // 현재는 ENABLE_RAG=true여도 빈 배열 반환
  void role
  void topK
  return []
}
