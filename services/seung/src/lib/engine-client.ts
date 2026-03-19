export async function callEngineParse(file: File): Promise<Response> {
  const form = new FormData()
  form.append('file', file)
  return fetch(`${process.env.ENGINE_BASE_URL}/api/resume/parse`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(30_000),
  })
}

export async function callEngineQuestions(resumeText: string): Promise<Response> {
  return fetch(`${process.env.ENGINE_BASE_URL}/api/resume/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumeText }),
    signal: AbortSignal.timeout(30_000),
  })
}
