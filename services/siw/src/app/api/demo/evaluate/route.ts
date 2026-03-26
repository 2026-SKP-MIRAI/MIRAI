export const runtime = "nodejs"
export const maxDuration = 90

export async function POST(request: Request) {
  const body = await request.json()
  const { targetRole, question, answer, persona } = body

  if (!targetRole || !question || !answer || !persona) {
    return Response.json(
      { message: "targetRole, question, answer, persona가 필요합니다." },
      { status: 400 }
    )
  }

  const PERSONA_LABELS: Record<string, string> = {
    hr: "HR 담당자",
    tech_lead: "기술팀장",
    executive: "경영진",
  }

  const item = {
    persona,
    personaLabel: PERSONA_LABELS[persona] ?? persona,
    question,
    answer,
  }
  // 엔진이 최소 5개 history를 요구하므로 데모용으로 동일 항목을 반복
  const history = Array(5).fill(item)

  const baseUrl = process.env.ENGINE_BASE_URL
  if (!baseUrl) return Response.json({ message: "ENGINE_BASE_URL 환경변수가 설정되지 않았습니다" }, { status: 500 })
  const engineUrl = baseUrl + "/api/report/generate"

  try {
    const engineRes = await fetch(engineUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeText: `지원 직무: ${targetRole}\n\n이력서 미제출 상태입니다.`,
        history,
      }),
      signal: AbortSignal.timeout(85000),
    })

    if (!engineRes.ok) {
      return Response.json({ message: "평가 생성에 실패했습니다." }, { status: 502 })
    }

    const data = await engineRes.json()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { usage: _usage, ...rest } = data
    return Response.json(rest, { status: 200 })
  } catch {
    return Response.json({ message: "평가 생성에 실패했습니다." }, { status: 502 })
  }
}
