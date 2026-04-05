import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "edge";

const sessionIdSchema = z.string().uuid();

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
};

function getScoreColor(score: number): string {
  if (score >= 80) return "#0D9488";
  if (score >= 60) return "#F59E0B";
  return "#EF4444";
}

function FallbackCard() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        backgroundColor: "#ffffff",
        padding: "60px",
      }}
    >
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "#0D9488",
          marginBottom: 24,
        }}
      >
        Fint
      </div>
      <div
        style={{
          fontSize: 36,
          fontWeight: 700,
          color: "#111827",
          marginBottom: 12,
        }}
      >
        내 면접 결과 보기
      </div>
      <div
        style={{
          fontSize: 20,
          color: "#6B7280",
        }}
      >
        Fint AI 모의면접
      </div>
    </div>
  );
}

function OGCard({
  totalScore,
  jobCategory,
  summary,
}: {
  totalScore: number;
  jobCategory: string;
  summary: string;
}) {
  const scoreColor = getScoreColor(totalScore);
  const summaryPreview = summary.slice(0, 80);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: "#ffffff",
        padding: "60px",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 24,
          fontWeight: 700,
          color: "#0D9488",
        }}
      >
        Fint
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 20,
            color: "#374151",
          }}
        >
          내 면접 점수는
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 96,
              fontWeight: 900,
              color: scoreColor,
              lineHeight: 1,
            }}
          >
            {totalScore}점
          </span>
          <span
            style={{
              fontSize: 32,
              color: "#9CA3AF",
            }}
          >
            / 100
          </span>
        </div>

        <div
          style={{
            fontSize: 18,
            color: "#6B7280",
          }}
        >
          {jobCategory}
        </div>

        <div
          style={{
            fontSize: 16,
            color: "#6B7280",
            textAlign: "center",
            maxWidth: 800,
          }}
        >
          {summaryPreview}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          fontSize: 14,
          color: "#0D9488",
        }}
      >
        fint.app
      </div>
    </div>
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success) {
    return new ImageResponse(<FallbackCard />, {
      width: 1200,
      height: 630,
      headers: CACHE_HEADERS,
    });
  }

  try {
    const supabase = createServiceClient();

    const [reportResult, sessionResult] = await Promise.all([
      supabase
        .from("reports")
        .select("total_score, summary")
        .eq("session_id", parsed.data)
        .eq("is_public", true)
        .single(),
      supabase
        .from("interview_sessions")
        .select("job_category")
        .eq("id", parsed.data)
        .single(),
    ]);

    if (reportResult.error || !reportResult.data) {
      return new ImageResponse(<FallbackCard />, {
        width: 1200,
        height: 630,
        headers: CACHE_HEADERS,
      });
    }

    const { total_score, summary } = reportResult.data;
    const jobCategory = sessionResult.data?.job_category ?? "";

    return new ImageResponse(
      <OGCard
        totalScore={total_score}
        jobCategory={jobCategory}
        summary={summary ?? ""}
      />,
      {
        width: 1200,
        height: 630,
        headers: CACHE_HEADERS,
      }
    );
  } catch {
    return new ImageResponse(<FallbackCard />, {
      width: 1200,
      height: 630,
      headers: CACHE_HEADERS,
    });
  }
}
