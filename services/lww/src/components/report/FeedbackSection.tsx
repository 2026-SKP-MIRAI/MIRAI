"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, Wrench } from "lucide-react";
import { AxisScore } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FeedbackSectionProps {
  axisFeedback: AxisScore[];
}

export function FeedbackSection({ axisFeedback }: FeedbackSectionProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const strengths = axisFeedback.filter(a => a.type === "strength");
  const improvements = axisFeedback.filter(a => a.type === "improvement");

  const FeedbackGroup = ({
    items,
    type,
  }: {
    items: AxisScore[];
    type: "strength" | "improvement";
  }) => (
    <div className="space-y-2">
      <div className={cn(
        "flex items-center gap-2 rounded-xl p-3",
        type === "strength" ? "bg-teal-50" : "bg-yellow-50"
      )}>
        {type === "strength" ? (
          <CheckCircle2 className="w-4 h-4 text-[#0D9488]" />
        ) : (
          <Wrench className="w-4 h-4 text-yellow-600" />
        )}
        <span className="text-sm font-semibold text-[--color-foreground]">
          {type === "strength" ? "잘 하셨어요" : "이렇게 해보세요"}
        </span>
      </div>
      {items.map((item) => (
        <div key={item.axis} className="bg-white rounded-xl border border-[--color-border] overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            onClick={() => setExpanded(expanded === item.axis ? null : item.axis)}
          >
            <span className="text-sm font-medium text-[--color-foreground]">{item.axisLabel}</span>
            {expanded === item.axis ? (
              <ChevronUp className="w-4 h-4 text-[--color-muted-foreground] shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[--color-muted-foreground] shrink-0" />
            )}
          </button>
          {expanded === item.axis && (
            <div className="px-4 pb-3 text-sm text-gray-600 leading-relaxed border-t border-[--color-border] pt-2">
              {item.feedback}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {strengths.length > 0 && <FeedbackGroup items={strengths} type="strength" />}
      {improvements.length > 0 && <FeedbackGroup items={improvements} type="improvement" />}
    </div>
  );
}
