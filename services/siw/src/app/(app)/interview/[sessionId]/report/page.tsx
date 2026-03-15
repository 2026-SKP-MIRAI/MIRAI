"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReportResult from "@/components/ReportResult";
import type { ReportResponse } from "@/lib/types";

export default function ReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const res = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorCode(res.status);
        setError(data.message ?? "리포트 생성에 실패했습니다");
        return;
      }
      setReport(data);
    } catch {
      setError("리포트 생성에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col">
      <header className="glass-panel sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <Link href="/" className="text-xl font-bold gradient-text">MirAI</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 w-full">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <span className="w-8 h-8 border-2 border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin" />
            <p className="text-sm text-[#9CA3AF]">역량 리포트를 분석 중입니다... (최대 60초 소요됩니다)</p>
          </div>
        )}

        {!loading && error && errorCode === 422 && (
          <div className="glass-card rounded-2xl p-8 text-center">
            <p className="text-[#1F2937] font-medium mb-2">질문을 더 진행해 주세요</p>
            <p className="text-sm text-[#9CA3AF] mb-6">{error}</p>
            <Link
              href={`/interview/${sessionId}`}
              className="btn-primary rounded-xl px-6 py-3"
            >
              면접으로 돌아가기
            </Link>
          </div>
        )}

        {!loading && error && errorCode !== 422 && (
          <div className="glass-card rounded-2xl p-8 text-center">
            <p className="text-[#1F2937] font-medium mb-4">리포트 생성에 실패했습니다</p>
            <button onClick={fetchReport} className="btn-outline rounded-xl px-6 py-3">
              다시 시도
            </button>
          </div>
        )}

        {!loading && report && <ReportResult report={report} />}
      </main>
    </div>
  );
}
