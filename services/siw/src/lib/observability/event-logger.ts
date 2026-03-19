import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import * as fs from "fs/promises";
import * as path from "path";

export interface LLMEvent {
  timestamp: string;
  feature_type:
    | "interview_start" | "interview_answer" | "interview_followup"
    | "report_generate" | "resume_parse" | "resume_questions" | "practice_feedback";
  mode: "interview" | "practice" | "resume";
  latency_ms: number;
  success: boolean;
  error_type?: string;
  session_id?: string | null;
  retry_count?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  model?: string;
}

export interface EngineUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  model?: string;
}

const MODEL_COST_PER_1K: Record<string, { input: number; output: number }> = {
  "google/gemini-2.5-flash": { input: 0.00015, output: 0.0006 },
};

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const cost = MODEL_COST_PER_1K[model];
  if (!cost) return 0.0;
  return (promptTokens / 1000) * cost.input + (completionTokens / 1000) * cost.output;
}

const FEATURE_MODE: Record<LLMEvent["feature_type"], LLMEvent["mode"]> = {
  interview_start:    "interview",
  interview_answer:   "interview",
  interview_followup: "interview",
  report_generate:    "interview",
  practice_feedback:  "practice",
  resume_parse:       "resume",
  resume_questions:   "resume",
};

export interface LLMEventMeta {
  retry_count: number;
  usage?: EngineUsage;
}

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({ region: process.env.AWS_REGION ?? "ap-northeast-2" });
  }
  return s3Client;
}

export async function logLLMEvents(events: LLMEvent[]): Promise<void> {
  const body = events.map(e => JSON.stringify(e)).join("\n");
  const bucket = process.env.S3_LOG_BUCKET;

  try {
    if (bucket) {
      const now = new Date();
      const yyyy = now.getUTCFullYear();
      const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(now.getUTCDate()).padStart(2, "0");
      const prefix = process.env.S3_LOG_PREFIX ?? "llm-events";
      const key = `${prefix}/${yyyy}/${mm}/${dd}/${now.toISOString()}-${crypto.randomUUID().slice(0, 8)}.jsonl`;
      await getS3Client().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "application/x-ndjson" }));
    } else {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const logDir = path.join(process.cwd(), "logs", "llm-events");
      await fs.mkdir(logDir, { recursive: true });
      await fs.appendFile(path.join(logDir, `${dateStr}.jsonl`), body + "\n", "utf-8");
    }
  } catch (err) {
    console.error("[event-logger] logLLMEvents failed:", err);
  }
}

export async function withEventLogging<T>(
  featureType: LLMEvent["feature_type"],
  sessionId: string | null,
  fn: (meta: LLMEventMeta) => Promise<T>,
): Promise<T> {
  const meta: LLMEventMeta = { retry_count: 0 };
  const start = Date.now();
  try {
    const data = await fn(meta);
    await logLLMEvents([{
      timestamp: new Date().toISOString(),
      feature_type: featureType,
      mode: FEATURE_MODE[featureType],
      latency_ms: Math.max(1, Date.now() - start),
      success: true,
      session_id: sessionId,
      retry_count: meta.retry_count,
      prompt_tokens: meta.usage?.prompt_tokens,
      completion_tokens: meta.usage?.completion_tokens,
      model: meta.usage?.model,
    }]);
    return data;
  } catch (err) {
    await logLLMEvents([{
      timestamp: new Date().toISOString(),
      feature_type: featureType,
      mode: FEATURE_MODE[featureType],
      latency_ms: Math.max(1, Date.now() - start),
      success: false,
      error_type: err instanceof Error ? err.message : String(err),
      session_id: sessionId,
      retry_count: meta.retry_count,
    }]);
    throw err;
  }
}
