import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@aws-sdk/client-s3", () => {
  const mockSend = vi.fn();
  const S3Client = vi.fn(() => ({ send: mockSend }));
  const PutObjectCommand = vi.fn((input: unknown) => ({ input }));
  return { S3Client, PutObjectCommand, __mockSend: mockSend };
});

vi.mock("fs/promises", () => ({
  default: {
    appendFile: vi.fn(),
    mkdir: vi.fn(),
  },
  appendFile: vi.fn(),
  mkdir: vi.fn(),
}));

describe("event-logger", () => {
  beforeEach(() => {
    vi.resetModules(); // S3Client singleton 테스트간 격리
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  // TC1: S3 적재 성공
  it("logLLMEvents: S3_LOG_BUCKET 설정 시 PutObjectCommand 호출", async () => {
    vi.stubEnv("S3_LOG_BUCKET", "mirai-logs");
    vi.stubEnv("AWS_REGION", "ap-northeast-2");

    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const s3Instance = { send: vi.fn().mockResolvedValue({}) };
    vi.mocked(S3Client).mockReturnValue(s3Instance as never);

    const { logLLMEvents } = await import("@/lib/observability/event-logger");

    await logLLMEvents([
      {
        timestamp: new Date().toISOString(),
        feature_type: "interview_start",
        latency_ms: 100,
        success: true,
      },
    ]);

    expect(PutObjectCommand).toHaveBeenCalledOnce();
    expect(s3Instance.send).toHaveBeenCalledOnce();

    const cmdArg = vi.mocked(PutObjectCommand).mock.calls[0][0] as {
      Bucket: string;
      Key: string;
      Body: string;
    };
    expect(cmdArg.Bucket).toBe("mirai-logs");
    expect(cmdArg.Key).toMatch(/llm-events\/\d{4}\/\d{2}\/\d{2}\//);
    expect(cmdArg.Body).toContain("interview_start");
  });

  // TC2: 로컬 fallback
  it("logLLMEvents: S3_LOG_BUCKET 미설정 시 fs.promises.appendFile 호출", async () => {
    vi.unstubAllEnvs();

    const fs = await import("fs/promises");
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.appendFile).mockResolvedValue(undefined);

    const { logLLMEvents } = await import("@/lib/observability/event-logger");

    await logLLMEvents([
      {
        timestamp: new Date().toISOString(),
        feature_type: "resume_parse",
        latency_ms: 200,
        success: true,
      },
    ]);

    expect(fs.appendFile).toHaveBeenCalledOnce();
    const [filePath, content] = vi.mocked(fs.appendFile).mock.calls[0] as [
      string,
      string,
    ];
    expect(filePath).toMatch(/llm-events/);
    expect(filePath).toMatch(/\.jsonl$/);
    expect(content).toContain("resume_parse");
  });

  // TC3: S3 실패 무영향
  it("logLLMEvents: S3 실패해도 throw 안함", async () => {
    vi.stubEnv("S3_LOG_BUCKET", "mirai-logs");

    const { S3Client } = await import("@aws-sdk/client-s3");
    const s3Instance = {
      send: vi.fn().mockRejectedValue(new Error("S3 network error")),
    };
    vi.mocked(S3Client).mockReturnValue(s3Instance as never);

    const { logLLMEvents } = await import("@/lib/observability/event-logger");

    await expect(
      logLLMEvents([
        {
          timestamp: new Date().toISOString(),
          feature_type: "report_generate",
          latency_ms: 300,
          success: false,
          error_type: "timeout",
        },
      ]),
    ).resolves.toBeUndefined();
  });

  // TC4: 로컬 fallback 실패 무영향
  it("logLLMEvents: 로컬 파일 쓰기 실패해도 throw 안함", async () => {
    vi.unstubAllEnvs();

    const fs = await import("fs/promises");
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.appendFile).mockRejectedValue(
      new Error("disk full") as never,
    );

    const { logLLMEvents } = await import("@/lib/observability/event-logger");

    await expect(
      logLLMEvents([
        {
          timestamp: new Date().toISOString(),
          feature_type: "practice_feedback",
          latency_ms: 150,
          success: true,
        },
      ]),
    ).resolves.toBeUndefined();
  });

  // TC5: withEventLogging 성공
  it("withEventLogging: 성공 시 success=true, latency_ms>0, 반환값 보존", async () => {
    vi.unstubAllEnvs();

    const fs = await import("fs/promises");
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.appendFile).mockResolvedValue(undefined);

    const { withEventLogging } = await import(
      "@/lib/observability/event-logger"
    );

    const result = await withEventLogging(
      "interview_answer",
      "session-abc",
      async () => ({ answer: "mock result" }),
    );

    expect(result).toEqual({ answer: "mock result" });
    expect(fs.appendFile).toHaveBeenCalledOnce();

    const content = vi.mocked(fs.appendFile).mock.calls[0][1] as string;
    const parsed = JSON.parse(content.trim());
    expect(parsed.success).toBe(true);
    expect(parsed.latency_ms).toBeGreaterThan(0);
    expect(parsed.feature_type).toBe("interview_answer");
    expect(parsed.session_id).toBe("session-abc");
  });

  // TC6: withEventLogging 실패
  it("withEventLogging: fn 실패 시 success=false, 원 에러 re-throw", async () => {
    vi.unstubAllEnvs();

    const fs = await import("fs/promises");
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.appendFile).mockResolvedValue(undefined);

    const { withEventLogging } = await import(
      "@/lib/observability/event-logger"
    );

    const originalError = new Error("engine call failed");

    await expect(
      withEventLogging("interview_followup", null, async () => {
        throw originalError;
      }),
    ).rejects.toThrow("engine call failed");

    expect(fs.appendFile).toHaveBeenCalledOnce();
    const content = vi.mocked(fs.appendFile).mock.calls[0][1] as string;
    const parsed = JSON.parse(content.trim());
    expect(parsed.success).toBe(false);
    expect(parsed.error_type).toBe("engine call failed");
  });

  // TC7: JSONL 포맷 — 복수 이벤트
  it("logLLMEvents: 복수 이벤트를 JSONL로 전송", async () => {
    vi.unstubAllEnvs();

    const fs = await import("fs/promises");
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.appendFile).mockResolvedValue(undefined);

    const { logLLMEvents } = await import("@/lib/observability/event-logger");

    const events = [
      {
        timestamp: new Date().toISOString(),
        feature_type: "interview_start" as const,
        latency_ms: 100,
        success: true,
      },
      {
        timestamp: new Date().toISOString(),
        feature_type: "interview_answer" as const,
        latency_ms: 200,
        success: false,
        error_type: "engine error",
      },
    ];

    await logLLMEvents(events);

    expect(fs.appendFile).toHaveBeenCalledOnce();
    const content = vi.mocked(fs.appendFile).mock.calls[0][1] as string;
    const lines = content
      .trim()
      .split("\n")
      .filter((l) => l.length > 0);
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).feature_type).toBe("interview_start");
    expect(JSON.parse(lines[1]).feature_type).toBe("interview_answer");
  });

  // TC9: retry_count 기록
  it("withEventLogging: meta.retry_count가 로그에 기록됨", async () => {
    vi.unstubAllEnvs();

    const fs = await import("fs/promises");
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.appendFile).mockResolvedValue(undefined);

    const { withEventLogging } = await import("@/lib/observability/event-logger");

    await withEventLogging("interview_start", null, async (meta) => {
      meta.retry_count = 2;
      return "ok";
    });

    const content = vi.mocked(fs.appendFile).mock.calls[0][1] as string;
    const parsed = JSON.parse(content.trim());
    expect(parsed.retry_count).toBe(2);
    expect(parsed.success).toBe(true);
  });

  // TC10: retry_count 기본값 0
  it("withEventLogging: retry 없으면 retry_count=0", async () => {
    vi.unstubAllEnvs();

    const fs = await import("fs/promises");
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.appendFile).mockResolvedValue(undefined);

    const { withEventLogging } = await import("@/lib/observability/event-logger");

    await withEventLogging("interview_followup", "session-xyz", async () => "ok");

    const content = vi.mocked(fs.appendFile).mock.calls[0][1] as string;
    const parsed = JSON.parse(content.trim());
    expect(parsed.retry_count).toBe(0);
  });

  // TC11: estimateCostUsd — 알려진 모델
  it("estimateCostUsd: google/gemini-2.5-flash 정확한 비용 반환", async () => {
    const { estimateCostUsd } = await import("@/lib/observability/event-logger");
    const cost = estimateCostUsd("google/gemini-2.5-flash", 1000, 500);
    // (1000/1000)*0.00015 + (500/1000)*0.0006 = 0.00015 + 0.0003 = 0.00045
    expect(cost).toBeCloseTo(0.00045, 8);
  });

  // TC12: estimateCostUsd — 알 수 없는 모델
  it("estimateCostUsd: 알 수 없는 모델은 0.0 반환", async () => {
    const { estimateCostUsd } = await import("@/lib/observability/event-logger");
    const cost = estimateCostUsd("unknown-model", 100, 50);
    expect(cost).toBe(0.0);
  });

  // TC13: withEventLogging usage 필드 전달
  it("withEventLogging: usage 필드가 로그 이벤트에 포함됨", async () => {
    vi.unstubAllEnvs();

    const fs = await import("fs/promises");
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.appendFile).mockResolvedValue(undefined);

    const { withEventLogging } = await import("@/lib/observability/event-logger");

    await withEventLogging("resume_parse", "session-usage", async (meta) => {
      meta.usage = { prompt_tokens: 100, completion_tokens: 50, model: "google/gemini-2.5-flash" };
      return "parsed";
    });

    const content = vi.mocked(fs.appendFile).mock.calls[0][1] as string;
    const parsed = JSON.parse(content.trim());
    expect(parsed.prompt_tokens).toBe(100);
    expect(parsed.completion_tokens).toBe(50);
    expect(parsed.model).toBe("google/gemini-2.5-flash");
  });

  // TC8: S3 key 패턴 — YYYY/MM/DD/ 포함
  it("logLLMEvents: S3 key가 YYYY/MM/DD/ 패턴 포함", async () => {
    vi.stubEnv("S3_LOG_BUCKET", "mirai-logs");
    vi.stubEnv("S3_LOG_PREFIX", "custom-prefix");

    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const s3Instance = { send: vi.fn().mockResolvedValue({}) };
    vi.mocked(S3Client).mockReturnValue(s3Instance as never);

    const { logLLMEvents } = await import("@/lib/observability/event-logger");

    const now = new Date();
    const yyyy = now.getUTCFullYear().toString();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");

    await logLLMEvents([
      {
        timestamp: now.toISOString(),
        feature_type: "resume_questions",
        latency_ms: 50,
        success: true,
      },
    ]);

    const cmdArg = vi.mocked(PutObjectCommand).mock.calls[0][0] as {
      Key: string;
    };
    expect(cmdArg.Key).toMatch(
      new RegExp(`custom-prefix/${yyyy}/${mm}/${dd}/`),
    );
  });
});
