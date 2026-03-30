import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { PersonaType, QuestionType } from '@/lib/types'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/event-logger'

export const maxDuration = 35

const ENGINE_FETCH_TIMEOUT_MS = 55_000
const DEFAULT_PERSONAS: PersonaType[] = ['hr', 'tech_lead', 'executive']
const NEWS_CONTEXT_LIMIT = 5

// targetRole(자유형식) → NewsArticle.role(카테고리) 매핑
const ROLE_CATEGORY_MAP: Record<string, string> = {
  'IT': 'IT/개발', '개발': 'IT/개발', '백엔드': 'IT/개발', '프론트엔드': 'IT/개발',
  '엔지니어': 'IT/개발', '데이터': 'IT/개발', '소프트웨어': 'IT/개발',
  '마케팅': '마케팅', '마케터': '마케팅', '광고': '마케팅', '브랜드': '마케팅',
  '금융': '금융', '은행': '금융', '투자': '금융', '증권': '금융', '핀테크': '금융',
  '의료': '의료', '의사': '의료', '간호': '의료', '헬스케어': '의료', '바이오': '의료',
  '영업': '영업', '세일즈': '영업',
  '회계': '회계/재무', '재무': '회계/재무', '세무': '회계/재무', '경리': '회계/재무',
  '인사': '인사/HR', 'HR': '인사/HR', '채용': '인사/HR', '노무': '인사/HR',
}

function resolveNewsRole(targetRole: string): string | null {
  for (const [keyword, role] of Object.entries(ROLE_CATEGORY_MAP)) {
    const isEnglish = /^[A-Za-z]+$/.test(keyword)
    const pattern = isEnglish
      ? new RegExp(`\\b${keyword}\\b`, 'i')
      : new RegExp(keyword, 'i')
    if (pattern.test(targetRole)) return role
  }
  return null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const rlResult = rateLimit(`${user.id}:interview/start`, 10, 60_000)
  if (rlResult !== true) {
    return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429, headers: { 'Retry-After': String(rlResult) } })
  }

  let body: { resumeId?: string; mode?: string; personas?: PersonaType[]; interviewMode?: 'real' | 'practice'; targetRole?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청을 읽을 수 없습니다.' }, { status: 400 })
  }

  const { resumeId, personas = DEFAULT_PERSONAS, interviewMode, targetRole } = body

  if (!resumeId) {
    return NextResponse.json({ error: 'resumeId가 필요합니다.' }, { status: 400 })
  }

  // Fetch resume from DB
  let resume: { resumeText: string } | null
  try {
    resume = await prisma.resume.findUnique({ where: { id: resumeId, userId: user.id } })
  } catch (err) {
    console.error('[interview/start] DB resume lookup failed', { resumeId, err })
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!resume) {
    return NextResponse.json({ error: '자소서를 찾을 수 없습니다.' }, { status: 404 })
  }

  // targetRole 기반 뉴스 컨텍스트 조회 (실패해도 면접 진행 차단 금지)
  let newsContext: string[] = []
  const newsRole = targetRole ? resolveNewsRole(targetRole) : null
  if (newsRole) {
    try {
      const news = await prisma.newsArticle.findMany({
        where: { role: newsRole },
        orderBy: { publishedAt: 'desc' },
        take: NEWS_CONTEXT_LIMIT,
        select: { title: true },
      })
      newsContext = news.map((n) => n.title)
    } catch (err) {
      console.error('[interview/start] news fetch failed, degrading', { newsRole, err })
    }
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
      body: JSON.stringify({
        resumeText: newsContext.length > 0
          ? `[최근 업계 동향]\n${newsContext.map((n) => `- ${n}`).join('\n')}\n\n${resume.resumeText}`
          : resume.resumeText,
        personas,
        mode: 'panel',
      }),
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
        userId: user.id,
      },
    })
  } catch (err) {
    console.error('[interview/start] session create failed', { resumeId, err })
    return NextResponse.json({ error: '세션을 생성할 수 없습니다.' }, { status: 500 })
  }

  logEvent({
    event_type: 'session_started',
    user_id: user.id,
    session_id: session.id,
    properties: { resume_id: resumeId, interview_mode: interviewMode ?? 'real', personas },
  }).catch((err) => console.error('[event-logger] session_started failed', err))

  return NextResponse.json({ sessionId: session.id, firstQuestion }, { status: 200 })
}
