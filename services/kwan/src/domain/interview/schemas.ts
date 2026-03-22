import { z } from 'zod'

// --- 인프라: engine /analyze 응답 ---
export const EngineAnalyzeResponseSchema = z.object({
  resumeText: z.string().refine((s) => s.trim().length > 0),
  extractedLength: z.number(),
  targetRole: z.string().optional(),
})

export const CategorySchema = z.enum(['직무 역량', '경험의 구체성', '성과 근거', '기술 역량'])

export const QuestionSchema = z.object({
  category: CategorySchema,
  question: z.string(),
})

export const EngineQuestionsResponseSchema = z.object({
  questions: z.array(QuestionSchema),
  meta: z.object({
    extractedLength: z.number(),
    categoriesUsed: z.array(z.string()),
  }),
})

export const PersonaSchema = z.enum(['hr', 'tech_lead', 'executive'])

export const QueueItemSchema = z.object({
  persona: PersonaSchema,
  type: z.enum(['main', 'follow_up']),
})

export const HistoryItemSchema = z.object({
  persona: PersonaSchema,
  personaLabel: z.string(),
  question: z.string(),
  answer: z.string(),
  questionType: z.enum(['main', 'follow_up']).optional(),
})

export const QuestionWithPersonaSchema = z.object({
  persona: PersonaSchema,
  personaLabel: z.string(),
  question: z.string(),
  type: z.enum(['main', 'follow_up']),
})

// 엔진 응답 스키마
export const EngineStartResponseSchema = z.object({
  firstQuestion: QuestionWithPersonaSchema,
  questionsQueue: z.array(QueueItemSchema),
})

export const EngineAnswerResponseSchema = z.object({
  nextQuestion: QuestionWithPersonaSchema.nullable(),
  updatedQueue: z.array(QueueItemSchema),
  sessionComplete: z.boolean(),
})

// --- 기능 02: 이력서 피드백 ---
export const ResumeFeedbackScoresSchema = z.object({
  specificity: z.number().min(0).max(100),
  achievementClarity: z.number().min(0).max(100),
  logicStructure: z.number().min(0).max(100),
  roleAlignment: z.number().min(0).max(100),
  differentiation: z.number().min(0).max(100),
})

export const SuggestionSchema = z.object({
  section: z.string(),
  issue: z.string(),
  suggestion: z.string(),
})

export const ResumeFeedbackResponseSchema = z.object({
  scores: ResumeFeedbackScoresSchema,
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  suggestions: z.array(SuggestionSchema).min(1),
})

// --- 기능 05: 연습 모드 피드백 ---
export const ComparisonDeltaSchema = z.object({
  scoreDelta: z.number(),
  improvements: z.array(z.string()),
})

export const PracticeFeedbackResponseSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.object({
    good: z.array(z.string()),
    improve: z.array(z.string()),
  }),
  keywords: z.array(z.string()),
  improvedAnswerGuide: z.string(),
  comparisonDelta: ComparisonDeltaSchema.nullable().optional(),
})

// --- 기능 07: 8축 역량 리포트 ---
export const AxisScoresSchema = z.object({
  communication: z.number().min(0).max(100),
  problemSolving: z.number().min(0).max(100),
  logicalThinking: z.number().min(0).max(100),
  jobExpertise: z.number().min(0).max(100),
  cultureFit: z.number().min(0).max(100),
  leadership: z.number().min(0).max(100),
  creativity: z.number().min(0).max(100),
  sincerity: z.number().min(0).max(100),
})

export const AxisFeedbackSchema = z.object({
  axis: z.string(),
  axisLabel: z.string(),
  score: z.number(),
  type: z.enum(['strength', 'improvement']),
  feedback: z.string(),
})

export const ReportGenerateResponseSchema = z.object({
  totalScore: z.number(),
  scores: AxisScoresSchema,
  summary: z.string(),
  axisFeedbacks: z.array(AxisFeedbackSchema).min(8).max(8),
})
