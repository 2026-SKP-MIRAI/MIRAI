import { cn } from "@/lib/utils";

interface InterviewRecord {
  id: string;
  date: string;
  jobCategories: string[];
  score: number;
}

interface InterviewHistoryCardProps {
  record: InterviewRecord;
}

export function InterviewHistoryCard({ record }: InterviewHistoryCardProps) {
  const scoreColor =
    record.score >= 80 ? "text-[#0D9488]" :
    record.score >= 60 ? "text-yellow-600" :
    "text-amber-500";

  const formattedDate = (() => {
    try {
      const d = new Date(record.date);
      if (isNaN(d.getTime())) return record.date;
      return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
    } catch {
      return record.date;
    }
  })();

  return (
    <div className="bg-white rounded-2xl border border-[--color-border] border-l-4 border-l-[#0D9488] p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
        <span className="text-lg">🎙️</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[--color-foreground] truncate">
          {record.jobCategories.join(", ")}
        </p>
        <p className="text-xs text-[--color-muted-foreground]">{formattedDate}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className={cn("text-base font-bold tabular-nums", scoreColor)}>{record.score}점</span>
        <span className="text-[--color-muted-foreground] ml-1">→</span>
      </div>
    </div>
  );
}
