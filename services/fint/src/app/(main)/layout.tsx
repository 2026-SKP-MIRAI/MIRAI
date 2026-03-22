import { MobileShell } from "@/components/layout/MobileShell";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { ToastProvider } from "@/components/ui/toast";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <MobileShell>
        <main className="flex-1 pb-16">
          {children}
        </main>
        <BottomTabBar />
      </MobileShell>
    </ToastProvider>
  );
}
