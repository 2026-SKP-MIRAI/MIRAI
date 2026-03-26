import crypto from "crypto"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(request: Request) {
  const body = await request.json()
  const { targetRole } = body

  if (!targetRole) {
    return Response.json({ message: "targetRole이 필요합니다." }, { status: 400 })
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"
  const ipHash = crypto
    .createHash("sha256")
    .update(ip + (process.env.DEMO_RATE_LIMIT_SALT ?? "mirai-demo"))
    .digest("hex")
  const date = new Date().toISOString().slice(0, 10)

  const usage = await prisma.demoUsage.upsert({
    where: { ipHash_date: { ipHash, date } },
    create: { ipHash, date, count: 1 },
    update: { count: { increment: 1 } },
  })

  if (usage.count > 3) {
    const tomorrow = new Date()
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    tomorrow.setUTCHours(0, 0, 0, 0)
    return Response.json(
      {
        message:
          "오늘의 무료 체험 횟수를 모두 사용하셨습니다. 가입하시면 무제한으로 이용할 수 있습니다.",
        resetAt: tomorrow.toISOString(),
      },
      { status: 429 }
    )
  }

  const engineUrl =
    (process.env.ENGINE_BASE_URL ?? "http://localhost:8000") +
    "/api/interview/start"

  try {
    const engineRes = await fetch(engineUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeText: `지원 직무: ${targetRole}`,
        personas: ["hr"],
        mode: "panel",
      }),
      signal: AbortSignal.timeout(25000),
    })

    if (!engineRes.ok) {
      return Response.json({ message: "질문 생성에 실패했습니다." }, { status: 502 })
    }

    const data = await engineRes.json()

    return Response.json(
      {
        question: data.question,
        persona: data.persona,
        remainingToday: 3 - usage.count,
      },
      { status: 200 }
    )
  } catch {
    return Response.json({ message: "질문 생성에 실패했습니다." }, { status: 502 })
  }
}
