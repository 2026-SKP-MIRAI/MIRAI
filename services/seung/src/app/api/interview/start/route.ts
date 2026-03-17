import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { PersonaType, QuestionType } from '@/lib/types'

export const maxDuration = 35

const ENGINE_FETCH_TIMEOUT_MS = 55_000
const DEFAULT_PERSONAS: PersonaType[] = ['hr', 'tech_lead', 'executive']

export async function POST(request: NextRequest) {
  let body: { resumeId?: string; mode?: string; personas?: PersonaType[]; interviewMode?: 'real' | 'practice' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청을 읽을 수 없습니다.' }, { status: 400 })
  }

  const { resumeId, personas = DEFAULT_PERSONAS, interviewMode } = body

  if (!resumeId) {
    return NextResponse.json({ error: 'resumeId가 필요합니다.' }, { status: 400 })
  }

  // Fetch resume from DB
  let resume: { resumeText: string } | null
  try {
    resume = await prisma.resume.findUnique({ where: { id: resumeId } })
  } catch (err) {
    console.error('[interview/start] DB resume lookup failed', { resumeId, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!resume) {
    return NextResponse.json({ error: '자소서를 찾을 수 없습니다.' }, { status: 404 })
  }

  const engineUrl = process.env.ENGINE_BASE_URL
  if (!engineUrl) {
    return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
  }

  // Call engine
  let engineResponse: Response
  try {
    engineResponse = await fetch(`${engineUrl}/api/interview/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText: resume.resumeText, personas, mode: 'panel' }),
      signal: AbortSignal.timeout(ENGINE_FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    console.error('[interview/start] engine fetch failed', { resumeId, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  let engineData: {
    firstQuestion: { persona: PersonaType; personaLabel: string; question: string; type: QuestionType }
    questionsQueue: { persona: PersonaType; type: QuestionType }[]
  }
  try {
    engineData = await engineResponse.json()
  } catch (err) {
    console.error('[interview/start] engine response parse failed', { resumeId, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!engineResponse.ok) {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  const { firstQuestion, questionsQueue } = engineData

  // Create session in DB
  let session: { id: string }
  try {
    session = await prisma.interviewSession.create({
      data: {
        resumeId,
        questionsQueue: questionsQueue as object[],
        history: [],
        currentQuestion: firstQuestion.question,
        currentPersona: firstQuestion.persona,
        currentPersonaLabel: firstQuestion.personaLabel,
        currentQuestionType: firstQuestion.type,
        interviewMode: interviewMode ?? 'real',
      },
    })
  } catch (err) {
    console.error('[interview/start] session create failed', { resumeId, err })
    return NextResponse.json({ error: '세션을 생성할 수 없습니다.' }, { status: 500 })
  }

  return NextResponse.json({ sessionId: session.id, firstQuestion }, { status: 200 })
}
