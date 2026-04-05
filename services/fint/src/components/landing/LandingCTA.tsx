import Link from "next/link";

interface LandingCTAProps {
  text?: string;
  variant?: "primary" | "outline";
  className?: string;
}

export function LandingCTA({
  text = "지금 면접 시작하기",
  variant = "primary",
  className = "",
}: LandingCTAProps) {
  const base = "inline-block px-8 py-4 rounded-xl font-semibold text-base transition-all duration-200";
  const styles = {
    primary: "bg-[#0D9488] text-white hover:bg-[#0f766e] shadow-lg hover:shadow-xl hover:-translate-y-0.5",
    outline: "border-2 border-[#0D9488] text-[#0D9488] hover:bg-[#0D9488] hover:text-white",
  };
  return (
    <Link href="/resume" className={`${base} ${styles[variant]} ${className}`}>
      {text}
    </Link>
  );
}
