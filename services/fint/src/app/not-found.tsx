import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] px-6 text-center gap-6">
      <div className="w-16 h-16 rounded-full bg-[--color-muted] flex items-center justify-center">
        <SearchX className="w-8 h-8 text-[--color-muted-foreground]" />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[--color-foreground]">페이지를 찾을 수 없어요</h2>
        <p className="text-sm text-[--color-muted-foreground]">
          요청하신 페이지가 존재하지 않아요.
        </p>
      </div>
      <Button asChild>
        <Link href="/">홈으로 돌아가기</Link>
      </Button>
    </div>
  );
}
