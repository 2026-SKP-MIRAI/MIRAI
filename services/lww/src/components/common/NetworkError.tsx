import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NetworkErrorProps {
  onRetry?: () => void;
}

export function NetworkError({ onRetry }: NetworkErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-4">
      <div className="w-16 h-16 rounded-full bg-[--color-muted] flex items-center justify-center">
        <WifiOff className="w-8 h-8 text-[--color-muted-foreground]" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-[--color-foreground]">연결이 끊겼어요</h3>
        <p className="text-sm text-[--color-muted-foreground]">
          잠깐 기다렸다가 다시 시도해주세요.
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          다시 시도하기
        </Button>
      )}
    </div>
  );
}
