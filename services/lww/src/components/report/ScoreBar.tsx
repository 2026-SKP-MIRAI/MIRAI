import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ScoreBarProps {
  score: number;
  label?: string;
  size?: "sm" | "lg";
}

export function ScoreBar({ score, label, size = "sm" }: ScoreBarProps) {
  const color =
    score >= 80 ? "text-[#0D9488]" :
    score >= 60 ? "text-yellow-600" :
    "text-amber-500";

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[--color-muted-foreground]">{label}</span>
          <span className={cn("text-xs font-semibold", color)}>{score}점</span>
        </div>
      )}
      <Progress
        value={score}
        className={cn(
          size === "lg" ? "h-3" : "h-1.5",
          score >= 80
            ? "[&>*]:bg-gradient-to-r [&>*]:from-[#0D9488] [&>*]:to-[#34d399]"
            : score >= 60
              ? "[&>*]:bg-gradient-to-r [&>*]:from-yellow-400 [&>*]:to-yellow-300"
              : "[&>*]:bg-gradient-to-r [&>*]:from-amber-400 [&>*]:to-amber-300"
        )}
      />
    </div>
  );
}
