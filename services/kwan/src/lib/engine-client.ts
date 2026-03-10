export async function callEngineQuestions(file: File): Promise<Response> {
  const ENGINE_BASE_URL = process.env.ENGINE_BASE_URL ?? 'http://localhost:8000'
  const form = new FormData()
  form.append('file', file)
  return fetch(`${ENGINE_BASE_URL}/api/resume/questions`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(30_000),
  })
}
