const ENGINE_BASE_URL = process.env.ENGINE_BASE_URL ?? 'http://localhost:8000'

export async function callEngineQuestions(file: File): Promise<Response> {
  const form = new FormData()
  form.append('file', file)
  return fetch(`${ENGINE_BASE_URL}/api/resume/questions`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(30_000),
  })
}

export async function callEngineStart(payload: object): Promise<Response> {
  return fetch(`${ENGINE_BASE_URL}/api/interview/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  })
}

export async function callEngineAnswer(payload: object): Promise<Response> {
  return fetch(`${ENGINE_BASE_URL}/api/interview/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  })
}
