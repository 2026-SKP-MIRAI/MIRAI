export async function callEngineAnalyze(file: File): Promise<Response> {
  const form = new FormData()
  form.append('file', file)
  return fetch(`${process.env.ENGINE_BASE_URL}/api/resume/analyze`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(40_000),
  })
}

export async function callEngineQuestions(resumeText: string, targetRole?: string): Promise<Response> {
  return fetch(`${process.env.ENGINE_BASE_URL}/api/resume/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumeText, ...(targetRole ? { targetRole } : {}) }),
    signal: AbortSignal.timeout(30_000),
  })
}
