import { Separator } from "@/components/ui/separator";
import type { QuestionItem, QuestionsResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

interface QuestionListProps {
  /** 새 인터페이스: QuestionsResponse 객체를 직접 수신 */
  data?: QuestionsResponse;
  /** 레거시 인터페이스 (하위 호환) */
  questions?: QuestionItem[];
  onReset?: () => void;
  onStartInterview?: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  "직무 역량": "bg-blue-100 text-blue-700",
  "경험의 구체성": "bg-purple-100 text-purple-700",
  "성과 근거": "bg-green-100 text-green-700",
  "기술 역량": "bg-orange-100 text-orange-700",
};

function QuestionList({ data, questions: questionsProp, onReset, onStartInterview }: QuestionListProps) {
  const questions = data?.questions ?? questionsProp ?? [];
  const grouped = questions.reduce((acc, q) => {
    if (!acc[q.category]) acc[q.category] = [];
    acc[q.category].push(q);
    return acc;
  }, {} as Record<string, QuestionItem[]>);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[--color-foreground]">
          맞춤 예상 질문 {questions.length}개
        </h2>
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="bg-white rounded-2xl border border-[--color-border] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-[--color-muted]/50">
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", CATEGORY_COLORS[category] ?? "bg-[--color-muted] text-[--color-muted-foreground]")}>
                {category}
              </span>
              <span className="text-xs text-[--color-muted-foreground]">{items.length}개</span>
            </div>
            {items.map((q, i) => (
              <div key={i}>
                {i > 0 && <Separator />}
                <div className="px-4 py-3">
                  <p className="text-sm text-[--color-foreground] leading-relaxed" data-testid="question-item">
                    <span className="font-medium text-[#0D9488] mr-1">Q{i + 1}.</span>
                    {q.question}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {onReset && (
        <button
          onClick={onReset}
          className="w-full h-12 border border-[--color-border] text-[--color-foreground] font-semibold rounded-2xl hover:bg-[--color-muted] transition-colors"
        >
          다시하기
        </button>
      )}

      {onStartInterview && (
        <button
          onClick={onStartInterview}
          className="w-full h-12 bg-[#0D9488] text-white font-semibold rounded-2xl hover:bg-[#0F766E] transition-colors"
        >
          면접 시작하기
        </button>
      )}
    </div>
  );
}

export { QuestionList };
export default QuestionList;
