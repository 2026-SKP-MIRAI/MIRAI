import { z } from 'zod'

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
