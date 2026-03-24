import { cn } from "@/lib/utils";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCta?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  onCta,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6 gap-5",
        className
      )}
    >
      <div
        className="w-18 h-18 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(13,148,136,0.08)", width: 72, height: 72 }}
      >
        <Icon className="w-9 h-9" style={{ color: "#0D9488" }} />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-base font-bold text-gray-800">{title}</h3>
        <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
      </div>
      {ctaLabel && (
        ctaHref ? (
          <Link
            href={ctaHref}
            className="mt-1 inline-flex items-center justify-center h-12 px-8 text-sm font-bold text-white rounded-2xl transition-all duration-200 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #0D9488, #0F766E)",
              boxShadow: "0 6px 20px rgba(13,148,136,0.3)",
            }}
          >
            {ctaLabel}
          </Link>
        ) : (
          <button
            onClick={onCta}
            className="mt-1 inline-flex items-center justify-center h-12 px-8 text-sm font-bold text-white rounded-2xl transition-all duration-200 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #0D9488, #0F766E)",
              boxShadow: "0 6px 20px rgba(13,148,136,0.3)",
            }}
          >
            {ctaLabel}
          </button>
        )
      )}
    </div>
  );
}
