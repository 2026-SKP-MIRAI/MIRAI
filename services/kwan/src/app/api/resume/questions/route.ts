import { PDFParse } from 'pdf-parse'
import { callEngineQuestions } from '@/lib/engine-client'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const maxDuration = 35

async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const buffer = Buffer.from(arrayBuffer)
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    return result.text ?? ''
  } catch {
    return ''
  }
}

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return Response.json({ error: 'PDF 파일을 선택해주세요.' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const engineFile = new File([arrayBuffer], file.name, { type: file.type })

  try {
    const [engineRes, resumeText] = await Promise.all([
      callEngineQuestions(engineFile),
      extractTextFromPdf(arrayBuffer),
    ])

    const data = await engineRes.json().catch(() => ({ error: '서버 오류가 발생했습니다.' }))
    if (!engineRes.ok) {
      const msg = data.detail ?? '서버 오류가 발생했습니다.'
      return Response.json({ error: msg }, { status: engineRes.status })
    }

    if (!resumeText) {
      return Response.json({ ...data, resumeId: null }, { status: 200 })
    }

    const resume = await prisma.resume.create({
      data: { resumeText, questions: data.questions as object[] },
    })

    return Response.json({ ...data, resumeId: resume.id }, { status: 200 })
  } catch (error) {
    const isTimeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    const msg = isTimeout
      ? '요청 시간이 초과됐습니다. 잠시 후 다시 시도해주세요.'
      : '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    return Response.json({ error: msg }, { status: 500 })
  }
}
