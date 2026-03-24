import { cn } from "@/lib/utils";

interface MobileShellProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileShell({ children, className }: MobileShellProps) {
  return (
    <div
      className={cn(
        "w-full max-w-[430px] min-h-[100dvh] flex-1",
        "relative flex flex-col overflow-x-hidden",
        "bg-[--color-background]",
        className
      )}
    >
      {children}
    </div>
  );
}
