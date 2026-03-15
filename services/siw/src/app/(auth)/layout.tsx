export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F9FB] bg-grid flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* 배경 orbs */}
      <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%)", filter: "blur(80px)" }} />
      <div className="absolute -bottom-10 -right-10 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 70%)", filter: "blur(80px)" }} />
      <div className="relative z-10 w-full flex items-center justify-center">
        {children}
      </div>
    </div>
  )
}
