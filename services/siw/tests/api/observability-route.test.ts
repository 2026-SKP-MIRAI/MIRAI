import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: vi.fn() } }));

const mockRawRows = [
  {
    date: "2026-03-19",
    feature_type: "interview_start",
    call_count: 10,
    avg_latency_ms: 320.5,
    error_count: 1,
    error_rate: 0.1,
  },
];

const adminUser = {
  id: "uid-admin",
  app_metadata: { role: "admin" },
  user_metadata: {},
};

const normalUser = {
  id: "uid-user",
  app_metadata: { role: "user" },
  user_metadata: {},
};

function makeSupabase(user: object | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  };
}

function makeRequest(searchParams = "") {
  return new Request(`http://localhost/api/dashboard/observability${searchParams}`);
}

describe("GET /api/dashboard/observability", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { cookies } = await import("next/headers");
    (cookies as ReturnType<typeof vi.fn>).mockResolvedValue({ getAll: () => [] });
    const { prisma } = await import("@/lib/prisma");
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue(mockRawRows);
  });

  it("200 — 관리자 정상 조회: rows 배열 + summary 구조 검증", async () => {
    const { createServerClient } = await import("@/lib/supabase/server");
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(makeSupabase(adminUser));

    const { GET } = await import("@/app/api/dashboard/observability/route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.rows)).toBe(true);
    expect(data.rows).toHaveLength(1);

    const row = data.rows[0];
    expect(row).toHaveProperty("date", "2026-03-19");
    expect(row).toHaveProperty("featureType", "interview_start");
    expect(row).toHaveProperty("callCount", 10);
    expect(row).toHaveProperty("avgLatencyMs", 320.5);
    expect(row).toHaveProperty("errorCount", 1);
    expect(row).toHaveProperty("errorRate", 0.1);

    expect(data.summary).toMatchObject({
      totalCalls: 10,
      avgLatency: 320.5,
      avgErrorRate: 0.1,
      featureTypes: ["interview_start"],
      lastUpdated: "2026-03-19",
    });
  });

  it("200 — 관리자 빈 데이터: rows=[], summary.totalCalls=0, lastUpdated=null", async () => {
    const { createServerClient } = await import("@/lib/supabase/server");
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(makeSupabase(adminUser));
    const { prisma } = await import("@/lib/prisma");
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/dashboard/observability/route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rows).toEqual([]);
    expect(data.summary.totalCalls).toBe(0);
    expect(data.summary.lastUpdated).toBeNull();
  });

  it("401 — 미인증: user=null → 401", async () => {
    const { createServerClient } = await import("@/lib/supabase/server");
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(makeSupabase(null));

    const { GET } = await import("@/app/api/dashboard/observability/route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.message).toBe("인증이 필요합니다");
  });

  it("403 — 비관리자 (role=user): normalUser → 403, 메시지 확인", async () => {
    const { createServerClient } = await import("@/lib/supabase/server");
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(makeSupabase(normalUser));

    const { GET } = await import("@/app/api/dashboard/observability/route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.message).toBe("관리자 권한이 필요합니다");
  });

  it("403 — role 미설정 (app_metadata={}): → 403", async () => {
    const noRoleUser = { id: "x", app_metadata: {}, user_metadata: {} };
    const { createServerClient } = await import("@/lib/supabase/server");
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(makeSupabase(noRoleUser));

    const { GET } = await import("@/app/api/dashboard/observability/route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(403);
  });

  it("500 — DB 에러: $queryRaw throws Error → 500", async () => {
    const { createServerClient } = await import("@/lib/supabase/server");
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(makeSupabase(adminUser));
    const { prisma } = await import("@/lib/prisma");
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("db error"));

    const { GET } = await import("@/app/api/dashboard/observability/route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
  });

  it("200 — days 파라미터: days=7 → $queryRaw 호출 확인", async () => {
    const { createServerClient } = await import("@/lib/supabase/server");
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(makeSupabase(adminUser));
    const { prisma } = await import("@/lib/prisma");
    const mockQueryRaw = prisma.$queryRaw as ReturnType<typeof vi.fn>;
    mockQueryRaw.mockResolvedValueOnce(mockRawRows);

    const { GET } = await import("@/app/api/dashboard/observability/route");
    const res = await GET(makeRequest("?days=7"));

    expect(res.status).toBe(200);
    expect(mockQueryRaw).toHaveBeenCalled();
  });
});
