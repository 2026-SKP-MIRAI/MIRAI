"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LoadingPhaseText } from "@/components/report/LoadingPhaseText";
import { ScoreBar } from "@/components/report/ScoreBar";
import { CategoryScoreGrid } from "@/components/report/CategoryScoreGrid";
import { FeedbackSection } from "@/components/report/FeedbackSection";
import { OrbPreviewCard } from "@/components/report/OrbPreviewCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { TopBar } from "@/components/layout/TopBar";
import type { ReportResponse } from "@/lib/types";

export default function ReportPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const router = useRouter();

  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [exitTarget, setExitTarget] = useState<"history" | "home">("home");

  useEffect(() => {
    // sessionStorage에서 리포트 데이터 읽기
    const stored = sessionStorage.getItem(`report_${sessionId}`);
    if (stored) {
      try {
        setReport(JSON.parse(stored));
        setLoading(false);
      } catch {}
    }
  }, [sessionId]);

  const handleNavigate = (target: "history" | "home") => {
    setExitTarget(target);
    setShowExitDialog(true);
  };

  const handleConfirmExit = () => {
    try { sessionStorage.removeItem(`report_${sessionId}`); } catch {}
    router.push(exitTarget === "history" ? "/interview" : "/");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-6 px-6">
        <div className="relative flex items-center justify-center">
          <span className="absolute inline-flex h-16 w-16 animate-ping rounded-full bg-[#0D9488] opacity-20" />
          <span className="absolute inline-flex h-12 w-12 animate-ping rounded-full bg-[#0D9488] opacity-30 animation-delay-150" />
          <div className="relative z-10">
            <LoadingPhaseText />
          </div>
        </div>
        <p className="text-xs text-center text-[--color-muted-foreground]">
          평균 12-18초 소요돼요. 잠깐만 기다려주세요!
        </p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-4 px-6 text-center">
        <p className="text-base font-semibold">리포트를 불러올 수 없어요</p>
        <Button onClick={() => router.push("/")}>다시 연습하기</Button>
      </div>
    );
  }

  const scoreColor =
    report.totalScore >= 80 ? "text-[#0D9488]" :
    report.totalScore >= 60 ? "text-yellow-600" :
    "text-amber-500";

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[--color-background]">
      <TopBar title="면접 결과 리포트 📊" />

      <main className="flex-1 px-5 py-6 space-y-6 pb-24">
        {/* 종합 점수 */}
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-[--color-border] p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[--color-muted-foreground]">종합 점수</p>
            <span className="text-xs text-[--color-muted-foreground] bg-gray-100 rounded-full px-2 py-0.5">
              {new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
            </span>
          </div>
          <div className="flex items-end gap-2">
            <span className={`text-6xl font-black tabular-nums ${scoreColor}`}>{report.totalScore}</span>
            <span className="text-lg text-[--color-muted-foreground] mb-1">/ 100</span>
          </div>
          <ScoreBar score={report.totalScore} size="lg" />
          {report.totalScore < 60 && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 text-center">
              💪 처음엔 누구나 어려워요. 지금부터 함께 올라가봐요!
            </p>
          )}
          {report.summary && (
            <p className="text-sm text-[--color-muted-foreground] leading-relaxed border-t border-[--color-border] pt-3 border-l-4 border-l-[#0D9488] pl-3">
              {report.summary}
            </p>
          )}
        </div>

        {/* 카테고리 점수 */}
        {report.axisFeedbacks && report.axisFeedbacks.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">카테고리별 점수</h2>
            <CategoryScoreGrid axisFeedback={report.axisFeedbacks} />
          </div>
        )}

        {/* 피드백 */}
        {report.axisFeedbacks && report.axisFeedbacks.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">상세 피드백</h2>
            <FeedbackSection axisFeedback={report.axisFeedbacks} />
          </div>
        )}

        {/* 합격 예언 오브 */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">합격 예언 오브</h2>
          <OrbPreviewCard />
        </div>
      </main>

      {/* 하단 CTA */}
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-[--color-surface] border-t border-[--color-border] px-4 py-3 flex gap-2"
        style={{ paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom))` }}
      >
        <Button
          className="flex-1 bg-[#0D9488] hover:bg-[#0b7a70] text-white font-semibold"
          onClick={() => router.push("/interview")}
        >
          면접 기록 보기
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => router.push("/onboarding")}
        >
          다시 연습하기
        </Button>
      </div>

      {/* 이탈 확인 다이얼로그 */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>결과 화면을 나갈까요?</DialogTitle>
            <DialogDescription>
              이 결과는 아직 저장되지 않아요. 계속할까요?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExitDialog(false)}>
              취소
            </Button>
            <Button onClick={handleConfirmExit}>나가기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
