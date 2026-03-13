import { z } from "zod";

// ─── 기본 열거형 ───────────────────────────────────────────
export const PersonaTypeSchema = z.enum(["hr", "tech_lead", "executive"]);
export const QuestionTypeSchema = z.enum(["main", "follow_up"]);

// ─── DB JSON 필드 스키마 (findById 파싱용) ────────────────
export const QueueItemSchema = z.object({
  persona: PersonaTypeSchema,
  type: QuestionTypeSchema,
});

export const HistoryItemSchema = z.object({
  persona: PersonaTypeSchema,
  personaLabel: z.string(),
  question: z.string(),
  answer: z.string(),
  type: QuestionTypeSchema,
});

export const QueueItemArraySchema = z.array(QueueItemSchema);
export const HistoryItemArraySchema = z.array(HistoryItemSchema);

// ─── 엔진 응답 스키마 ─────────────────────────────────────
export const QuestionWithPersonaSchema = z.object({
  persona: PersonaTypeSchema,
  personaLabel: z.string(),
  question: z.string(),
  type: QuestionTypeSchema.optional(),
});

/** POST /api/interview/start 엔진 응답 */
export const EngineStartResponseSchema = z.object({
  firstQuestion: QuestionWithPersonaSchema,
  questionsQueue: z.array(QueueItemSchema),
});

/** POST /api/interview/answer 엔진 응답 */
export const EngineAnswerResponseSchema = z.object({
  nextQuestion: QuestionWithPersonaSchema.nullable(),
  updatedQueue: z.array(QueueItemSchema),
  sessionComplete: z.boolean(),
});
