'use client'

import { usePathname } from 'next/navigation'

type Props = {
  onSignOut: () => Promise<void>  // server action을 props로 받음
}

export default function NavBar({ onSignOut }: Props) {
  const pathname = usePathname()

  // 인증 페이지에서는 nav-bar 숨김
  if (pathname === '/login' || pathname === '/signup') return null

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-sm px-4 sm:px-6 py-3 flex items-center justify-between">
      <span className="text-lg font-bold text-[#1a1a2e]">MirAI</span>
      <form action={onSignOut}>
        <button
          type="submit"
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
        >
          로그아웃
        </button>
      </form>
    </nav>
  )
}
