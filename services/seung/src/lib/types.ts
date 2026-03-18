export type Question = {
  category: string
  question: string
}

export type PersonaType = 'hr' | 'tech_lead' | 'executive'
export type QuestionType = 'main' | 'follow_up'
export type QueueItem = { persona: PersonaType; type: QuestionType }
export type QuestionWithPersona = {
  persona: PersonaType
  personaLabel: string
  question: string
  type: QuestionType
}
export type HistoryItem = {
  persona: PersonaType
  personaLabel: string
  question: string
  answer: string
}

export type QuestionsResponse = {
  questions: Question[]
  meta: {
    extractedLength: number
    categoriesUsed: string[]
  }
  resumeId: string | null
}

export type InterviewStartRequest = {
  resumeId: string
  mode?: 'panel'
  personas?: PersonaType[]
  interviewMode?: 'real' | 'practice'
}
export type InterviewStartResponse = { sessionId: string; firstQuestion: QuestionWithPersona }
export type InterviewAnswerRequest = { sessionId: string; answer: string }
export type InterviewAnswerResponse = {
  nextQuestion: QuestionWithPersona | null
  sessionComplete: boolean
}
export type InterviewSessionState = {
  currentQuestion: string
  currentPersona: PersonaType
  currentPersonaLabel: string
  currentQuestionType: QuestionType
  history: (HistoryItem & { questionType?: QuestionType })[]
  sessionComplete: boolean
}

export type AxisScores = {
  communication: number
  problemSolving: number
  logicalThinking: number
  jobExpertise: number
  cultureFit: number
  leadership: number
  creativity: number
  sincerity: number
}

export type AxisFeedback = {
  axis: string
  axisLabel: string
  score: number
  type: 'strength' | 'improvement'
  feedback: string
}

export type ReportResponse = {
  id: string
  sessionId: string
  totalScore: number
  scores: AxisScores
  summary: string
  axisFeedbacks: AxisFeedback[]
  createdAt: string
}

export type StoredHistoryEntry = HistoryItem & { questionType?: string }

export type UploadState = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

export const ERROR_MESSAGES: Record<number, string> = {
  400: 'PDF 파일을 읽을 수 없습니다. 파일이 손상되지 않았는지 확인해 주세요.',
  413: '파일 크기가 너무 큽니다. 5MB 이하의 파일을 업로드해 주세요.',
  422: '텍스트를 읽을 수 없는 PDF입니다. 텍스트가 포함된 파일을 업로드해 주세요.',
  500: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
}

export const DEFAULT_ERROR_MESSAGE = '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'

export type FeedbackDetail = {
  good: string[]
  improve: string[]
}

export type ComparisonDelta = {
  scoreDelta: number
  improvements: string[]
}

export type PracticeFeedbackRequest = {
  question: string
  answer: string
  previousAnswer?: string
}

export type PracticeFeedbackResponse = {
  score: number
  feedback: FeedbackDetail
  keywords: string[]
  improvedAnswerGuide: string
  comparisonDelta?: ComparisonDelta | null
}
