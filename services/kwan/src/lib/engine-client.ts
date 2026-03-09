export async function callEngineQuestions(file: File): Promise<Response> {
  const form = new FormData()
  form.append('file', file)
  return fetch(`${process.env.ENGINE_BASE_URL}/api/resume/questions`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(30_000),
  })
}
