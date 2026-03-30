'use client'

import { usePathname, useRouter } from 'next/navigation'

type Props = {
  onSignOut: () => Promise<void>  // server action을 props로 받음
  isAdmin?: boolean
}

export default function NavBar({ onSignOut, isAdmin }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  // 인증 페이지에서는 nav-bar 숨김
  if (pathname === '/login' || pathname === '/signup') return null

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-sm px-4 sm:px-6 py-3 flex items-center justify-between">
      <span className="text-lg font-bold text-[#1a1a2e]">MirAI</span>
      <div className="flex items-center gap-2">
        {isAdmin && (
          <button
            onClick={() => router.push('/admin/submissions')}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            관리자
          </button>
        )}
        <form action={onSignOut}>
          <button
            type="submit"
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
          >
            로그아웃
          </button>
        </form>
      </div>
    </nav>
  )
}
