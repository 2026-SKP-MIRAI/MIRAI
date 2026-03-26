import type { PersonaType } from '@/domain/interview/types'
import type { z } from 'zod'
import type { QueueItemSchema, HistoryItemSchema } from '@/domain/interview/schemas'

const ENGINE_BASE_URL = process.env.ENGINE_BASE_URL ?? 'http://localhost:8000'

// 이미지 기반 PDF OCR 처리 최대 60초+ 소요 (2026-03-25 측정) — 엔진 ALB idle timeout(90s)보다 짧게 설정
const RESUME_ANALYZE_TIMEOUT_MS = 80_000
const DEFAULT_TIMEOUT_MS = 30_000   // /questions
const INTERVIEW_TIMEOUT_MS = 40_000  // /start, /answer — LLM 질문 생성 포함
const FEEDBACK_TIMEOUT_MS = 40_000
// ALB idle timeout 90s 기준 — 엔진이 먼저 abort하도록 85s로 설정
const REPORT_TIMEOUT_MS = 85_000

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
    signal: AbortSignal.timeout(RESUME_ANALYZE_TIMEOUT_MS),
  })
}

export async function callEngineQuestions(resumeText: string, targetRole?: string): Promise<Response> {
  return fetch(`${ENGINE_BASE_URL}/api/resume/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumeText, ...(targetRole ? { targetRole } : {}) }),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  })
}

export async function callEngineStart(payload: EngineStartPayload): Promise<Response> {
  return fetch(`${ENGINE_BASE_URL}/api/interview/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(INTERVIEW_TIMEOUT_MS),
  })
}

export async function callEngineAnswer(payload: EngineAnswerPayload): Promise<Response> {
  return fetch(`${ENGINE_BASE_URL}/api/interview/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(INTERVIEW_TIMEOUT_MS),
  })
}

export async function callEngineResumeFeedback(resumeText: string, targetRole: string): Promise<Response> {
  return fetch(`${ENGINE_BASE_URL}/api/resume/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumeText, targetRole }),
    signal: AbortSignal.timeout(FEEDBACK_TIMEOUT_MS),
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
    signal: AbortSignal.timeout(FEEDBACK_TIMEOUT_MS),
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
    signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
  })
}
