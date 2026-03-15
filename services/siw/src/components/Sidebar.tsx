"use client"
import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
} from "lucide-react"

type NavItem = {
  label: string
  href: string
  icon: React.ElementType
  activeCheck: (pathname: string) => boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "대시보드",
    href: "/dashboard",
    icon: LayoutDashboard,
    activeCheck: (p) => p === "/dashboard",
  },
  {
    label: "내 이력서",
    href: "/resumes",
    icon: FileText,
    activeCheck: (p) => p.startsWith("/resumes"),
  },
  {
    label: "면접",
    href: "/interview/new",
    icon: MessageSquare,
    activeCheck: (p) => p.startsWith("/interview/"),
  },
  {
    label: "성장 추이",
    href: "/growth",
    icon: TrendingUp,
    activeCheck: (p) => p === "/growth",
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full relative">
      {/* 로고 */}
      <Link href="/" className="flex items-center gap-3 px-5 py-6 shrink-0 hover:opacity-80 transition-opacity">
        <span
          className={`text-base font-extrabold whitespace-nowrap transition-[opacity,width] duration-150 ${
            !mobile && collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
          }`}
          style={{
            background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          MirAI
        </span>
      </Link>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {NAV_ITEMS.map((item) => {
          const active = item.activeCheck(pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 rounded-xl mx-2 px-3 py-2.5 text-sm transition-all duration-150 ${
                !mobile && collapsed ? "justify-center" : ""
              } ${
                active
                  ? "font-semibold text-violet-700"
                  : "text-gray-500 hover:text-gray-900 hover:bg-black/5"
              }`}
              style={
                active
                  ? { background: "linear-gradient(135deg, rgba(124,58,237,0.08), rgba(79,70,229,0.06))" }
                  : {}
              }
            >
              <item.icon className={`w-4 h-4 shrink-0 ${active ? "text-violet-600" : ""}`} />
              <span
                className={`whitespace-nowrap transition-[opacity,width] duration-150 ${
                  !mobile && collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                }`}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* 유저 영역 */}
      <div className="border-t border-black/[0.07] px-3 py-4 shrink-0">
        <div
          className={`flex items-center gap-2.5 px-2 py-2 rounded-xl mb-1.5 ${
            !mobile && collapsed ? "justify-center" : ""
          }`}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
          >
            U
          </div>
          <div
            className={`overflow-hidden transition-[opacity,width] duration-150 ${
              !mobile && collapsed ? "opacity-0 w-0" : "opacity-100"
            }`}
          >
            <p className="text-sm font-bold text-gray-900 whitespace-nowrap">사용자</p>
            <p className="text-xs text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis max-w-[140px]">
              user@example.com
            </p>
          </div>
        </div>
        <button
          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-gray-400 text-sm transition-all hover:bg-gray-100 hover:text-gray-600 ${
            !mobile && collapsed ? "justify-center" : ""
          }`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span
            className={`transition-[opacity,width] duration-150 ${
              !mobile && collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
            }`}
          >
            로그아웃
          </span>
        </button>
      </div>

      {/* 접기 버튼 (데스크탑 전용) */}
      {!mobile && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3.5 top-20 w-7 h-7 rounded-full bg-white border border-black/[0.12] flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm hover:shadow-md transition-all duration-150 z-10"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      )}
    </div>
  )

  return (
    <>
      {/* 모바일 햄버거 */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center border border-black/8"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* 모바일 오버레이 */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* 모바일 슬라이드 사이드바 */}
      <div
        className={`md:hidden fixed left-0 top-0 h-full w-60 bg-white z-40 shadow-xl transition-transform duration-250 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent mobile />
      </div>

      {/* 데스크탑 사이드바 */}
      <div
        className={`hidden md:flex flex-col bg-white border-r border-black/[0.08] h-screen sticky top-0 shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out ${
          collapsed ? "w-[68px]" : "w-60"
        }`}
      >
        <SidebarContent />
      </div>
    </>
  )
}
