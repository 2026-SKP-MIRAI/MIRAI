"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] px-6 text-center gap-6">
      <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-red-500" />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[--color-foreground]">문제가 발생했어요</h2>
        <p className="text-sm text-[--color-muted-foreground]">
          일시적인 오류예요. 다시 시도해주세요.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => window.location.href = "/"}>
          홈으로
        </Button>
        <Button onClick={reset}>다시 시도</Button>
      </div>
    </div>
  );
}
