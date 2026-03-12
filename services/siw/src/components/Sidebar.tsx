"use client"
import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, Play, LayoutDashboard, BarChart2, Dumbbell, Menu, X } from "lucide-react"

type NavItem = {
  label: string
  href: string
  icon: React.ElementType
  disabled?: boolean
}

const NAV_MAIN: NavItem[] = [
  { label: "내 자소서", href: "/resumes", icon: FileText },
  { label: "면접 시작", href: "/resume",  icon: Play },
]

const NAV_COMING: NavItem[] = [
  { label: "대시보드",    href: "#", icon: LayoutDashboard, disabled: true },
  { label: "면접 리포트", href: "#", icon: BarChart2,       disabled: true },
  { label: "연습 모드",   href: "#", icon: Dumbbell,        disabled: true },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* 로고 */}
      <div className="px-5 py-5">
        <Link href="/" onClick={() => setOpen(false)} className="block w-fit">
          <span className="text-xl font-bold gradient-text">MirAI</span>
          <p className="text-xs text-[#9CA3AF] mt-0.5">AI 면접 코치</p>
        </Link>
      </div>
      <div className="border-t border-black/6 mx-4" />

      {/* 메인 메뉴 */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_MAIN.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "nav-item-active font-semibold"
                  : "text-[#4B5563] hover:bg-[#F8F9FB] hover:text-[#1F2937]"
              }`}
            >
              <item.icon className={`w-4 h-4 shrink-0 ${active ? "text-[#4F46E5]" : ""}`} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-black/6 mx-4" />

      {/* 준비 중 */}
      <div className="px-3 py-4">
        <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider px-3 mb-2">곧 출시</p>
        <div className="space-y-0.5">
          {NAV_COMING.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm opacity-50 cursor-not-allowed"
            >
              <item.icon className="w-4 h-4 shrink-0 text-[#9CA3AF]" />
              <span className="text-[#9CA3AF]">{item.label}</span>
              <span className="tag tag-yellow ml-auto text-[10px] py-0 px-1.5">준비 중</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* 모바일 햄버거 */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center border border-black/8"
        onClick={() => setOpen(!open)}
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* 모바일 오버레이 */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/20 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 모바일 슬라이드 사이드바 */}
      <div className={`md:hidden fixed left-0 top-0 h-full w-64 bg-white z-40 transform transition-transform shadow-xl ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <SidebarContent />
      </div>

      {/* 데스크톱 사이드바 */}
      <div className="hidden md:flex flex-col w-64 bg-white border-r border-black/8 h-screen sticky top-0 shrink-0">
        <SidebarContent />
      </div>
    </>
  )
}
