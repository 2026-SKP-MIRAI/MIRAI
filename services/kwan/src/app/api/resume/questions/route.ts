import { callEngineQuestions } from '@/lib/engine-client'

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return Response.json({ error: 'PDF 파일을 선택해주세요.' }, { status: 400 })
  }

  try {
    const res = await callEngineQuestions(file)
    const data = await res.json()
    return Response.json(data, { status: res.status })
  } catch {
    return Response.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}
