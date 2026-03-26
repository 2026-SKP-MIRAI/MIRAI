export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  const body = await request.json()
  const { question, answer } = body

  if (!question || !answer) {
    return Response.json(
      { message: "question과 answer가 필요합니다." },
      { status: 400 }
    )
  }

  if (typeof answer === "string" && answer.trim() === "") {
    return Response.json({ message: "답변을 입력해주세요." }, { status: 400 })
  }

  const baseUrl = process.env.ENGINE_BASE_URL
  if (!baseUrl) return Response.json({ message: "ENGINE_BASE_URL 환경변수가 설정되지 않았습니다" }, { status: 500 })
  const engineUrl = baseUrl + "/api/practice/feedback"

  try {
    const engineRes = await fetch(engineUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer }),
      signal: AbortSignal.timeout(55000),
    })

    if (!engineRes.ok) {
      return Response.json({ message: "피드백 생성에 실패했습니다." }, { status: 502 })
    }

    const data = await engineRes.json()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { usage: _usage, ...rest } = data
    return Response.json(rest, { status: 200 })
  } catch {
    return Response.json({ message: "피드백 생성에 실패했습니다." }, { status: 502 })
  }
}
