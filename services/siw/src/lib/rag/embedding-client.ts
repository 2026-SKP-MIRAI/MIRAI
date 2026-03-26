/**
 * embedding-client.ts
 * RAG 파이프라인을 위한 텍스트 임베딩 클라이언트
 *
 * ENABLE_RAG=true 또는 ENABLE_RESUME_RAG=true 환경 변수가 설정된 경우에만 실제 호출을 수행한다.
 * 트렌드 스킬 조회는 vector-search.ts의 getTrendSkillsForRole()로 구현됨 (#163 ADR).
 * fetchTrendSkills()는 embedText()가 null을 반환할 때의 폴백 스텁으로만 유지.
 */

/**
 * ENGINE_BASE_URL 환경변수를 반환한다.
 * 미설정 시 null을 반환하여, 프로덕션에서 조용히 잘못된 엔드포인트로 요청이 나가는 것을 방지한다.
 */
export function getEngineBaseUrl(): string | null {
  return process.env.ENGINE_BASE_URL ?? null
}

/**
 * 임베딩 벡터가 유효한 float 배열인지 검증한다.
 * $queryRaw에 삽입하기 전 반드시 호출하여 SQL injection을 방지한다.
 */
export function isValidEmbeddingVector(vector: unknown[]): vector is number[] {
  return (
    vector.length > 0 &&
    vector.every((v) => typeof v === 'number' && Number.isFinite(v))
  )
}

export type EmbeddingVector = number[]

export type EmbeddingResult = {
  vector: EmbeddingVector
  model: string
  tokenCount: number
}

/**
 * 텍스트를 임베딩 벡터로 변환한다.
 * ENABLE_RAG 또는 ENABLE_RESUME_RAG 중 하나라도 true일 때만 실제 호출을 수행한다.
 * 엔진 POST /api/embed — { texts: string[] } → { embeddings: number[][], model, usage }
 */
export async function embedText(text: string): Promise<EmbeddingResult | null> {
  if (process.env.ENABLE_RAG !== "true" && process.env.ENABLE_RESUME_RAG !== "true") return null

  const baseUrl = getEngineBaseUrl()
  if (!baseUrl) return null

  const resp = await fetch(`${baseUrl}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts: [text] }),
    signal: AbortSignal.timeout(15000),
  })

  if (!resp.ok) return null

  const data = await resp.json().catch(() => null)
  if (!data?.embeddings?.[0]) return null

  const vector = data.embeddings[0]
  if (!Array.isArray(vector) || !isValidEmbeddingVector(vector)) return null

  return {
    vector,
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
