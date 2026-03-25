"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Mic, ShoppingBag, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

interface TabItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  disabled?: boolean;
}

interface BottomTabBarProps {
  isInterviewing?: boolean;
}

export function BottomTabBar({ isInterviewing = false }: BottomTabBarProps) {
  const pathname = usePathname();
  const { showToast } = useToast();

  const tabs: TabItem[] = [
    { href: "/", icon: Home, label: "홈", active: pathname === "/" },
    { href: "/interview", icon: Mic, label: "면접", active: pathname.startsWith("/interview") },
    { href: "/market", icon: ShoppingBag, label: "마켓", active: false, disabled: true },
    { href: "/community", icon: MessageCircle, label: "커뮤", active: false, disabled: true },
    { href: "/my", icon: User, label: "나", active: false, disabled: true },
  ];

  const handleTabClick = (tab: TabItem, e: React.MouseEvent) => {
    if (isInterviewing) {
      e.preventDefault();
      showToast("면접 중에는 다른 화면으로 이동할 수 없습니다");
      return;
    }
    if (tab.disabled) {
      e.preventDefault();
      showToast("곧 오픈해요! 조금만 기다려주세요 🚀");
    }
  };

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-around h-16 bg-white border-t border-gray-100 shadow-[0_-1px_12px_rgba(0,0,0,0.06)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={(e) => handleTabClick(tab, e)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full relative",
                "transition-all duration-150",
                tab.active
                  ? "text-[#0D9488]"
                  : tab.disabled
                    ? "text-gray-300"
                    : "text-gray-400"
              )}
            >
              {tab.active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-[#0D9488]" />
              )}
              <Icon className={cn("w-5 h-5 transition-all duration-150", tab.active && "scale-110")} />
              <span className={cn("text-[10px] font-medium", tab.active && "font-bold")}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
