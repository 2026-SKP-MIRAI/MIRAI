import { ArrowLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ChatTopBarProps {
  questionIndex: number;
  totalQuestions: number;
  onBack: () => void;
  personaName?: string;
}

const TOTAL_QUESTIONS = 5;

export function ChatTopBar({ questionIndex, totalQuestions, onBack, personaName = "AI 면접관" }: ChatTopBarProps) {
  const displayIndex = Math.min(questionIndex + 1, totalQuestions || TOTAL_QUESTIONS);
  const progress = Math.min((displayIndex / (totalQuestions || TOTAL_QUESTIONS)) * 100, 100);

  return (
    <header className="sticky top-0 z-40 bg-[--color-surface] border-b border-[--color-border]">
      <div className="flex items-center h-14 pl-4 gap-3">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-[--color-muted] transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[--color-foreground]">{personaName}</span>
            <span className="flex items-center gap-1 text-xs text-[#0D9488]">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse" />
              면접 진행 중
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Progress value={progress} className="h-1 flex-1 [&>*]:bg-gradient-to-r [&>*]:from-[#0D9488] [&>*]:to-[#34d399]" />
            <span className="text-xs text-[#0D9488] font-semibold shrink-0">
              {displayIndex}/{totalQuestions || TOTAL_QUESTIONS}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
