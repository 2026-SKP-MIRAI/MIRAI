import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { Mic } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { InterviewHistoryCard } from "@/components/interview/InterviewHistoryCard";
import Link from "next/link";

interface InterviewRecord {
  id: string;
  date: string;
  jobCategories: string[];
  score: number;
}

type SessionRow = { id: string; created_at: string; job_category: string; reports: { total_score: number }[] | null };

function toHistory(data: SessionRow[] | null): InterviewRecord[] {
  return (data ?? []).map(s => ({
    id: s.id,
    date: new Date(s.created_at).toLocaleDateString("ko-KR"),
    jobCategories: (s.job_category as string).split(", "),
    score: s.reports?.[0]?.total_score ?? 0,
  }));
}

export default async function InterviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let history: InterviewRecord[] = [];

  if (user) {
    // 로그인: user_id 기준 쿼리
    const { data } = await supabase
      .from("interview_sessions")
      .select("id, created_at, job_category, reports(total_score)")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false });

    history = toHistory(data as SessionRow[]);
  } else {
    // 비로그인: anon_id 기준 (service client, RLS 우회)
    const cookieStore = await cookies();
    const anonId = cookieStore.get("lww_anon_id")?.value;
    if (anonId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(anonId)) {
      const serviceClient = createServiceClient();
      const { data } = await serviceClient
        .from("interview_sessions")
        .select("id, created_at, job_category, reports(total_score)")
        .eq("anonymous_id", anonId)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      history = toHistory(data as SessionRow[]);
    }
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-gray-50">
      {/* 브랜드 액센트 스트립 */}
      <div className="h-1 w-full" style={{ background: "linear-gradient(to right, #0D9488, #164E63)" }} />
      <header className="h-14 pl-5 flex items-center justify-between bg-[--color-surface] border-b border-[--color-border] sticky top-0 z-40">
        <div className="w-9" />
        <span className="text-base font-semibold text-[--color-foreground]">내 면접 기록</span>
        <Link href="/onboarding" className="text-sm font-bold text-[#0D9488] whitespace-nowrap pr-5">
          + 새 면접
        </Link>
      </header>
      <main className="flex-1 px-5 py-5 pb-24">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span
              className="px-3 py-1 rounded-full text-sm font-bold"
              style={{ background: "rgba(13,148,136,0.1)", color: "#0D9488" }}
            >
              총 {history.length}회
            </span>
          </div>
        </div>

        {history.length === 0 ? (
          <EmptyState
            icon={Mic}
            title="면접 기록이 없어요"
            description="첫 면접을 완료하면 여기에 결과가 저장됩니다!"
            ctaLabel="면접 시작하기"
            ctaHref="/onboarding"
          />
        ) : (
          <div className="space-y-3">
            {history.map(record => (
              <InterviewHistoryCard key={record.id} record={record} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
