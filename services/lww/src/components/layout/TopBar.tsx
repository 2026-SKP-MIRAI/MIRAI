import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  backHref?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  className?: string;
}

export function TopBar({ title, showBack, backHref, onBack, right, className }: TopBarProps) {
  return (
    <header
      className={cn(
        "grid items-center h-14 px-5",
        "bg-[--color-surface] border-b border-[--color-border]",
        "sticky top-0 z-40",
        className
      )}
      style={{ gridTemplateColumns: "40px 1fr auto" }}
    >
      <div className="flex items-center">
        {showBack && (
          backHref ? (
            <Link
              href={backHref}
              className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[--color-foreground]" />
            </Link>
          ) : (
            <button
              onClick={onBack}
              className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[--color-foreground]" />
            </button>
          )
        )}
      </div>

      <div className="text-center">
        {title ? (
          <span className="text-base font-semibold text-[--color-foreground]">{title}</span>
        ) : (
          <span className="text-lg font-black bg-gradient-to-r from-[#0D9488] to-[#0F766E] bg-clip-text text-transparent">lww</span>
        )}
      </div>

      <div className="flex items-center justify-end">
        {right}
      </div>
    </header>
  );
}
