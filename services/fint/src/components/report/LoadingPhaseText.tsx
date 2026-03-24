"use client";

import { useEffect, useState } from "react";

const PHASES = [
  "답변을 분석하고 있어요...",
  "점수를 계산하고 있어요...",
  "피드백을 작성하고 있어요...",
];

export function LoadingPhaseText() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 5000),
      setTimeout(() => setPhase(2), 10000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 rounded-full border-2 border-[#0D9488] border-t-transparent animate-spin" />
      <p className="text-sm text-[--color-muted-foreground] transition-all duration-500">
        {PHASES[phase]}
      </p>
    </div>
  );
}
