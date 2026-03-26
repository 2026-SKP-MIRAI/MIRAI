import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { HistoryItem, QueueItem, PersonaType, QuestionType, StoredHistoryEntry } from '@/lib/types'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { parseSSEStream } from '@/lib/sse-utils'
import type { SSEEvent } from '@/lib/sse-utils'

export const maxDuration = 60

const ENGINE_FETCH_TIMEOUT_MS = 55_000

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const rlResult = rateLimit(`${user.id}:interview/answer`, 30, 60_000)
  if (rlResult !== true) {
    return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429, headers: { 'Retry-After': String(rlResult) } })
  }

  let body: { sessionId?: string; answer?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청을 읽을 수 없습니다.' }, { status: 400 })
  }

  const { sessionId, answer } = body

  if (!sessionId || answer === undefined) {
    return NextResponse.json({ error: 'sessionId와 answer가 필요합니다.' }, { status: 400 })
  }

  if (!answer.trim()) {
    return NextResponse.json({ error: '답변을 입력해 주세요.' }, { status: 400 })
  }

  let session: {
    id: string
    userId: string | null
    resumeId: string
    currentQuestion: string
    currentPersona: string
    currentPersonaLabel: string
    currentQuestionType: string
    sessionComplete: boolean
    history: unknown
    questionsQueue: unknown
    updatedAt: Date
  } | null
  try {
    session = await prisma.interviewSession.findUnique({ where: { id: sessionId } })
  } catch (err) {
    console.error('[interview/answer] session lookup failed', { sessionId, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!session) {
    return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
  }

  if (session.userId !== user.id) {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  if (session.sessionComplete) {
    return NextResponse.json({ error: '이미 완료된 면접 세션입니다.' }, { status: 400 })
  }

  let resume: { resumeText: string } | null
  try {
    resume = await prisma.resume.findUnique({ where: { id: session.resumeId } })
  } catch (err) {
    console.error('[interview/answer] resume lookup failed', { sessionId, resumeId: session.resumeId, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!resume) {
    return NextResponse.json({ error: '자소서를 찾을 수 없습니다.' }, { status: 404 })
  }

  const history = session.history as unknown as StoredHistoryEntry[]
  const questionsQueue = session.questionsQueue as unknown as QueueItem[]
  const trimmedAnswer = answer.trim().slice(0, 5000)

  const engineUrl = process.env.ENGINE_BASE_URL
  if (!engineUrl) {
    return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
  }

  let engineResponse: Response
  try {
    // AbortSignal.timeout: 스트리밍 시 첫 byte 수신까지의 연결 timeout으로 동작 (55초)
    engineResponse = await fetch(`${engineUrl}/api/interview/answer?stream=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resumeText: resume.resumeText,
        history: history.map(({ questionType: _qt, ...rest }) => rest),
        questionsQueue,
        currentQuestion: session.currentQuestion,
        currentPersona: session.currentPersona,
        currentAnswer: trimmedAnswer,
      }),
      signal: AbortSignal.timeout(ENGINE_FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    console.error('[interview/answer] engine fetch failed', { sessionId, err })
    if ((err as { name?: string }).name === 'TimeoutError') {
      return NextResponse.json({ error: '응답이 지연되고 있습니다. 다시 시도해주세요.' }, { status: 504 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!engineResponse.ok || !engineResponse.body) {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 502 })
  }

  const encoder = new TextEncoder()
  const [drainStream, clientStream] = engineResponse.body.tee()

  // drain: 클라이언트 disconnect와 무관하게 done 이벤트까지 완주하여 DB 업데이트 보장
  const drainPromise = (async () => {
    let doneReceived = false
    try {
      for await (const event of parseSSEStream(drainStream)) {
        if (event.type === 'done') {
          doneReceived = true
          const doneEvent = event as Extract<SSEEvent, { type: 'done' }>
          const nextQuestion = doneEvent.nextQuestion as {
            persona: PersonaType
            personaLabel: string
            question: string
            type: QuestionType
          } | null
          const updatedQueue = doneEvent.updatedQueue as QueueItem[]
          const newHistoryEntry: StoredHistoryEntry = {
            persona: session.currentPersona as HistoryItem['persona'],
            personaLabel: session.currentPersonaLabel,
            question: session.currentQuestion,
            answer: trimmedAnswer,
            questionType: session.currentQuestionType,
          }
          try {
            await prisma.interviewSession.update({
              where: { id: sessionId, sessionComplete: false, updatedAt: session.updatedAt },
              data: {
                history: [...history, newHistoryEntry] as object[],
                questionsQueue: updatedQueue as object[],
                sessionComplete: doneEvent.sessionComplete,
                ...(nextQuestion ? {
                  currentQuestion: nextQuestion.question,
                  currentPersona: nextQuestion.persona,
                  currentPersonaLabel: nextQuestion.personaLabel,
                  currentQuestionType: nextQuestion.type,
                } : {}),
              },
            })
          } catch (dbErr) {
            if ((dbErr as { code?: string }).code === 'P2025') {
              // 동시 요청으로 이미 완료된 세션 — 무시
              return
            }
            console.error('[interview/answer] drain DB 처리 실패:', dbErr)
          }
        }
      }
      if (!doneReceived) {
        console.error('[interview/answer] done 이벤트 없이 스트림 종료 — DB 미업데이트', { sessionId })
      }
    } catch (err) {
      console.error('[interview/answer] drain stream 오류:', err)
    }
  })()

  const responseStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of parseSSEStream(clientStream)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        }
      } catch {
        // 클라이언트 disconnect — drain은 계속 진행
      }
      controller.close()
      // 클라이언트 스트림 종료 후 drain 완료 대기 (disconnect 후에도 DB 업데이트 보장)
      await drainPromise
    },
  })

  return new Response(responseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
