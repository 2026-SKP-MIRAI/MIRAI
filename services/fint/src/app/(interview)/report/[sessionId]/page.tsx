import { createClient } from "@/lib/supabase/server";
import { getAnonId } from "@/lib/anon-cookie";
import { ReportContent } from "@/components/report/ReportContent";
import type { ReportResponse } from "@/lib/types";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select("total_score, summary")
    .eq("session_id", sessionId)
    .eq("is_public", true)
    .single();

  if (!data) {
    return { title: "면접 결과 리포트 | Fint" };
  }

  const title = `내 면접 점수는 ${data.total_score}점! | Fint`;
  const description = data.summary?.slice(0, 100) ?? "AI 모의면접 결과를 확인해보세요";
  const ogImage = `/api/og/report?sessionId=${sessionId}`;

  return {
    title,
    openGraph: {
      title,
      description,
      images: [ogImage],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ReportPage({ params }: Props) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const { data: reportRow } = await supabase
    .from("reports")
    .select("total_score, summary, axis_feedbacks, anonymous_id")
    .eq("session_id", sessionId)
    .eq("is_public", true)
    .single();

  let isOwner = false;
  if (reportRow) {
    const anonId = await getAnonId();
    isOwner = !!anonId && anonId === reportRow.anonymous_id;
  }

  const initialReport: ReportResponse | null = reportRow
    ? {
        totalScore: reportRow.total_score,
        summary: reportRow.summary,
        axisFeedbacks: reportRow.axis_feedbacks ?? [],
        growthCurve: null,
      }
    : null;

  return (
    <ReportContent
      sessionId={sessionId}
      initialReport={initialReport}
      isOwner={isOwner}
    />
  );
}
