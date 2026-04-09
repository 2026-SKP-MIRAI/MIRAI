'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const HIDE_ON = ['/', '/login', '/signup']
const NAV_TABS = [
  { label: '대시보드', href: '/dashboard' },
  { label: '업로드', href: '/upload' },
  { label: '면접', href: '/interview' },
]

export default function NavBar({ onSignOut }: { onSignOut?: () => void }) {
  const pathname = usePathname()
  if (HIDE_ON.includes(pathname)) return null

  const isLoggedIn = !!onSignOut
  const visibleTabs = isLoggedIn ? NAV_TABS : NAV_TABS.filter(t => t.href === '/upload')

  const isActive = (href: string) =>
    href === '/interview'
      ? pathname.startsWith('/interview') || pathname.startsWith('/diagnosis') || pathname.startsWith('/report')
      : pathname.startsWith(href)

  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{
        background: 'var(--kwan-navbar)',
        borderColor: 'var(--kwan-border)',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" style={{ color: 'var(--kwan-teal)', fontWeight: 700, fontSize: '1.125rem' }}>
          MirAI
        </Link>

        {/* Pill Tabs */}
        <div className="flex items-center gap-1">
          {visibleTabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`pill-tab${isActive(tab.href) ? ' active' : ''}`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Logout */}
        {onSignOut && (
          <form action={onSignOut}>
            <button
              type="submit"
              style={{
                fontSize: '0.8125rem',
                color: 'var(--kwan-text-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.25rem 0.5rem',
              }}
            >
              로그아웃
            </button>
          </form>
        )}
      </div>
    </nav>
  )
}
