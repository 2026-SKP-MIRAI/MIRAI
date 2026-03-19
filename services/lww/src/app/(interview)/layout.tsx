import { MobileShell } from "@/components/layout/MobileShell";
import { ToastProvider } from "@/components/ui/toast";

export default function InterviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <MobileShell>
        {children}
      </MobileShell>
    </ToastProvider>
  );
}
