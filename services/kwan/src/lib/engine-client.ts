import type { PersonaType } from '@/domain/interview/types'
import type { z } from 'zod'
import type { QueueItemSchema, HistoryItemSchema } from '@/domain/interview/schemas'

const ENGINE_BASE_URL = process.env.ENGINE_BASE_URL ?? 'http://localhost:8000'

type QueueItem = z.infer<typeof QueueItemSchema>
type HistoryItem = z.infer<typeof HistoryItemSchema>

interface EngineStartPayload {
  resumeText: string
  personas: PersonaType[]
  mode: 'panel'
}

interface EngineAnswerPayload {
  resumeText: string
  history: Omit<HistoryItem, 'questionType'>[]
  questionsQueue: QueueItem[]
  currentQuestion: string
  currentPersona: PersonaType
  currentAnswer: string
}

export async function callEngineAnalyze(file: Blob): Promise<Response> {
  const form = new FormData()
  form.append('file', file)
  return fetch(`${ENGINE_BASE_URL}/api/resume/analyze`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(30_000),
  })
}

export async function callEngineQuestions(resumeText: string, targetRole?: string): Promise<Response> {
  return fetch(`${ENGINE_BASE_URL}/api/resume/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumeText, ...(targetRole ? { targetRole } : {}) }),
    signal: AbortSignal.timeout(30_000),
  })
}

export async function callEngineStart(payload: EngineStartPayload): Promise<Response> {
  return fetch(`${ENGINE_BASE_URL}/api/interview/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  })
}

export async function callEngineAnswer(payload: EngineAnswerPayload): Promise<Response> {
  return fetch(`${ENGINE_BASE_URL}/api/interview/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  })
}

export async function callEngineResumeFeedback(resumeText: string, targetRole: string): Promise<Response> {
  return fetch(`${ENGINE_BASE_URL}/api/resume/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumeText, targetRole }),
    signal: AbortSignal.timeout(40_000),
  })
}

export async function callEnginePracticeFeedback(
  question: string,
  answer: string,
  previousAnswer?: string,
): Promise<Response> {
  return fetch(`${ENGINE_BASE_URL}/api/practice/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, answer, ...(previousAnswer ? { previousAnswer } : {}) }),
    signal: AbortSignal.timeout(40_000),
  })
}

export async function callEngineReportGenerate(
  resumeText: string,
  history: Omit<HistoryItem, 'questionType'>[],
): Promise<Response> {
  return fetch(`${ENGINE_BASE_URL}/api/report/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumeText, history }),
    signal: AbortSignal.timeout(90_000),
  })
}
