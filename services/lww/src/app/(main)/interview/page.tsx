"use client";

import { useEffect, useState } from "react";
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

export default function InterviewPage() {
  const [history, setHistory] = useState<InterviewRecord[]>([]);

  useEffect(() => {
    // localStorage에서 면접 기록 읽기 (MVP)
    try {
      const stored = localStorage.getItem("interview_history");
      if (stored) setHistory(JSON.parse(stored));
    } catch {}
  }, []);

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
            {history.length < 3 && (
              <div className="mt-4 flex flex-col items-center gap-2 py-6 opacity-60">
                <span className="text-2xl">💪</span>
                <p className="text-xs text-gray-400 text-center leading-relaxed">
                  면접을 더 많이 쌓을수록<br />성장이 눈에 보여요!
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
