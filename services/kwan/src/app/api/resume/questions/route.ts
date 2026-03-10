import { callEngineQuestions } from '@/lib/engine-client'

export const runtime = 'nodejs'
export const maxDuration = 35

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return Response.json({ error: 'PDF 파일을 선택해주세요.' }, { status: 400 })
  }

  try {
    const res = await callEngineQuestions(file)
    const data = await res.json().catch(() => ({ error: '서버 오류가 발생했습니다.' }))
    if (!res.ok) {
      const msg = data.detail ?? '서버 오류가 발생했습니다.'
      return Response.json({ error: msg }, { status: res.status })
    }
    return Response.json(data, { status: res.status })
  } catch (error) {
    const isTimeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    const msg = isTimeout
      ? '요청 시간이 초과됐습니다. 잠시 후 다시 시도해주세요.'
      : '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    return Response.json({ error: msg }, { status: 500 })
  }
}
