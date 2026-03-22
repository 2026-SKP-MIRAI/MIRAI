export type Category = '직무 역량' | '경험의 구체성' | '성과 근거' | '기술 역량'

export interface Question {
  category: Category
  question: string
}

export type Persona = 'hr' | 'tech_lead' | 'executive'
export type PersonaType = Persona

export type FollowupType = 'CLARIFY' | 'CHALLENGE' | 'EXPLORE'

export interface QuestionWithPersona {
  persona: Persona
  personaLabel: string
  question: string
  type: 'main' | 'follow_up'
}

export interface QueueItem {
  persona: Persona
  type: 'main' | 'follow_up'
}

export interface HistoryItem {
  persona: Persona
  personaLabel: string
  question: string
  answer: string
  questionType?: 'main' | 'follow_up'
}

export interface InterviewSession {
  id: string
  resumeId: string
  questionsQueue: QueueItem[]
  history: HistoryItem[]
  sessionComplete: boolean
}

export interface GenerateResult {
  questions: Question[]
  meta: {
    extractedLength: number
    categoriesUsed: string[]
  }
  resumeId: string | null
  inferredTargetRole: string | null
}

export type UploadState = 'idle' | 'uploading' | 'confirming' | 'processing' | 'done' | 'error'

export type InterviewMode = 'real' | 'practice'
export type PracticeStepState = 'idle' | 'first-feedback' | 'retry-feedback'

export interface FeedbackScores {
  specificity: number
  achievementClarity: number
  logicStructure: number
  roleAlignment: number
  differentiation: number
}

export interface SuggestionItem {
  section: string
  issue: string
  suggestion: string
}

export interface AxisScores {
  communication: number
  problemSolving: number
  logicalThinking: number
  jobExpertise: number
  cultureFit: number
  leadership: number
  creativity: number
  sincerity: number
}

export interface AxisFeedback {
  axis: string
  axisLabel: string
  score: number
  type: 'strength' | 'improvement'
  feedback: string
}

export interface ComparisonDelta {
  scoreDelta: number
  improvements: string[]
}

export interface PracticeFeedback {
  score: number
  feedback: { good: string[]; improve: string[] }
  keywords: string[]
  improvedAnswerGuide: string
  comparisonDelta?: ComparisonDelta | null
}
