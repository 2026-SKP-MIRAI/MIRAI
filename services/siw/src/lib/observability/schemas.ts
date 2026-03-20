import { z } from "zod";

export const LlmEventsDailyRowSchema = z.object({
  date: z.string(),
  feature_type: z.string(),
  call_count: z.number(),
  avg_latency_ms: z.number(),
  error_count: z.number(),
  error_rate: z.number(),
  total_tokens: z.number().optional().default(0),
  estimated_cost_usd: z.number().optional().default(0),
  prompt_tokens: z.number().optional().default(0),
  completion_tokens: z.number().optional().default(0),
});
export type LlmEventsDailyRow = z.infer<typeof LlmEventsDailyRowSchema>;

export const ObservabilityRowSchema = z.object({
  date: z.string(),
  featureType: z.string(),
  callCount: z.number(),
  avgLatencyMs: z.number(),
  errorCount: z.number(),
  errorRate: z.number(),
  totalTokens: z.number().default(0),
  estimatedCostUsd: z.number().default(0),
  promptTokens: z.number().default(0),
  completionTokens: z.number().default(0),
});

export const ObservabilityResponseSchema = z.object({
  rows: z.array(ObservabilityRowSchema),
  summary: z.object({
    totalCalls: z.number(),
    avgLatency: z.number(),
    avgErrorRate: z.number(),
    featureTypes: z.array(z.string()),
    lastUpdated: z.string().nullable(),
    totalCostUsd: z.number(),
    totalTokens: z.number(),
  }),
});
export type ObservabilityResponse = z.infer<typeof ObservabilityResponseSchema>;
