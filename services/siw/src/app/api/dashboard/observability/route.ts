import { createServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { LlmEventsDailyRowSchema } from "@/lib/observability/schemas";
import type { ObservabilityResponse } from "@/lib/observability/schemas";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ message: "인증이 필요합니다" }, { status: 401 });
    }

    if ((user.app_metadata as { role?: string })?.role !== "admin") {
      return Response.json(
        { message: "관리자 권한이 필요합니다" },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const daysParam = url.searchParams.get("days");
    let days = 30;
    if (daysParam !== null) {
      const parsed = parseInt(daysParam, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 90) {
        days = parsed;
      }
    }

    const rows = await prisma.$queryRaw(
      Prisma.sql`
        SELECT
          date::TEXT AS date,
          feature_type AS feature_type,
          call_count::INT AS call_count,
          avg_latency_ms::FLOAT AS avg_latency_ms,
          error_count::INT AS error_count,
          error_rate::FLOAT AS error_rate,
          COALESCE(total_tokens, 0)::INT AS total_tokens,
          COALESCE(estimated_cost_usd, 0)::FLOAT AS estimated_cost_usd,
          COALESCE(prompt_tokens, 0)::INT AS prompt_tokens,
          COALESCE(completion_tokens, 0)::INT AS completion_tokens
        FROM analytics.llm_events_daily
        WHERE date >= CURRENT_DATE - (${days} * INTERVAL '1 day')
        ORDER BY date ASC, feature_type ASC
      `
    );

    const validated = z.array(LlmEventsDailyRowSchema).parse(rows);

    const camelRows = validated.map((row) => ({
      date: row.date,
      featureType: row.feature_type,
      callCount: row.call_count,
      avgLatencyMs: row.avg_latency_ms,
      errorCount: row.error_count,
      errorRate: row.error_rate,
      totalTokens: row.total_tokens ?? 0,
      estimatedCostUsd: row.estimated_cost_usd ?? 0,
      promptTokens: row.prompt_tokens ?? 0,
      completionTokens: row.completion_tokens ?? 0,
    }));

    const totalCalls = camelRows.reduce((sum, r) => sum + r.callCount, 0);
    // 호출 건수 가중 평균 — 단순 행 평균 사용 시 소량 호출 기능이 latency를 왜곡함
    const avgLatency =
      totalCalls > 0
        ? camelRows.reduce((sum, r) => sum + r.avgLatencyMs * r.callCount, 0) / totalCalls
        : 0;
    const totalErrors = camelRows.reduce((sum, r) => sum + r.errorCount, 0);
    const avgErrorRate = totalCalls > 0 ? totalErrors / totalCalls : 0;
    const featureTypes = [...new Set(camelRows.map((r) => r.featureType))];
    const lastUpdated =
      camelRows.length > 0 ? camelRows[camelRows.length - 1].date : null;
    const totalCostUsd = camelRows.reduce((sum, r) => sum + r.estimatedCostUsd, 0);
    const totalTokens = camelRows.reduce((sum, r) => sum + r.totalTokens, 0);

    const response: ObservabilityResponse = {
      rows: camelRows,
      summary: {
        totalCalls,
        avgLatency,
        avgErrorRate,
        featureTypes,
        lastUpdated,
        totalCostUsd,
        totalTokens,
      },
    };

    return Response.json(response);
  } catch {
    return Response.json(
      { message: "관찰 가능성 데이터를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
