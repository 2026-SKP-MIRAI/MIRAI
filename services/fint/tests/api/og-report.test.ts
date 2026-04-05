import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// @vercel/og mock — ImageResponse를 일반 Response처럼 동작하게 처리
vi.mock("@vercel/og", () => ({
  ImageResponse: class ImageResponse extends Response {
    constructor(_element: unknown, options?: ResponseInit & { headers?: Record<string, string> }) {
      const headers = new Headers({ "Content-Type": "image/png" });
      if (options?.headers) {
        Object.entries(options.headers).forEach(([k, v]) => headers.set(k, v));
      }
      super(new Uint8Array([0, 0]), { status: 200, headers });
    }
  },
}));

// supabase/server mock
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "@/lib/supabase/server";
import { GET } from "../../src/app/api/og/report/route";

const mockCreateServiceClient = vi.mocked(createServiceClient);

function buildRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/og/report");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString()) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/og/report", () => {
  it("valid sessionId with is_public=true report returns ImageResponse", async () => {
    const validId = "550e8400-e29b-41d4-a716-446655440000";

    mockCreateServiceClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "reports") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { total_score: 85, summary: "잘 했어요" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        // interview_sessions
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { job_category: "IT/개발" },
                error: null,
              }),
            }),
          }),
        };
      }),
    } as any);

    const response = await GET(buildRequest({ sessionId: validId }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("image/png");
  });

  it("invalid UUID returns fallback ImageResponse (200)", async () => {
    const response = await GET(buildRequest({ sessionId: "not-a-uuid" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("image/png");
  });

  it("missing sessionId returns fallback ImageResponse (200)", async () => {
    const response = await GET(buildRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("image/png");
  });
});
