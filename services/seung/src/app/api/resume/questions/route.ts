import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: '요청을 읽을 수 없습니다.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file) {
    return NextResponse.json({ error: '파일을 선택해 주세요.' }, { status: 400 })
  }

  const engineUrl = process.env.ENGINE_BASE_URL
  if (!engineUrl) {
    return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
  }

  const engineFormData = new FormData()
  engineFormData.append('file', file)

  try {
    const engineResponse = await fetch(`${engineUrl}/api/resume/questions`, {
      method: 'POST',
      body: engineFormData,
    })

    const data = await engineResponse.json()
    return NextResponse.json(data, { status: engineResponse.status })
  } catch {
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
