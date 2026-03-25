import { AxisScore } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CategoryScoreGridProps {
  axisFeedback: AxisScore[];
}

export function CategoryScoreGrid({ axisFeedback }: CategoryScoreGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {axisFeedback.slice(0, 6).map((axis) => {
        const color =
          axis.score >= 80 ? "text-[#0D9488]" :
          axis.score >= 60 ? "text-yellow-600" :
          "text-amber-500";

        const barColor =
          axis.score >= 80 ? "bg-[#0D9488]" :
          axis.score >= 60 ? "bg-yellow-400" :
          "bg-amber-400";

        const emoji =
          axis.score >= 80 ? "✅" :
          axis.score >= 60 ? "⚡" :
          "📈";

        return (
          <div
            key={axis.axis}
            className="flex flex-col items-center gap-1 bg-white rounded-2xl border border-[--color-border] p-4 overflow-hidden"
          >
            <span className="text-xs">{emoji}</span>
            <span className={cn("text-xl font-bold tabular-nums", color)}>{axis.score}</span>
            <span className="text-[11px] text-[--color-muted-foreground] text-center leading-tight w-full">
              {axis.axisLabel}
            </span>
            <div className="w-full mt-1 h-1 rounded-full bg-gray-100">
              <div
                className={cn("h-1 rounded-full", barColor)}
                style={{ width: `${axis.score}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
