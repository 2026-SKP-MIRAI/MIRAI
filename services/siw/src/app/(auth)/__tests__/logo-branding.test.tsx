import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import LoginPage from '../login/page'
import SignupPage from '../signup/page'

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowser: () => ({
    auth: { signInWithPassword: vi.fn(), signUp: vi.fn() },
  }),
}))

vi.mock('@/lib/auth/schemas', () => ({
  loginSchema: { safeParse: () => ({ success: true, data: {} }) },
  signupSchema: { safeParse: () => ({ success: true, data: {} }) },
}))

describe('Login 페이지 — 로고 브랜딩', () => {
  it('별 아이콘 SVG가 없다', () => {
    const { container } = render(<Suspense><LoginPage /></Suspense>)
    const starPaths = container.querySelectorAll('path[d*="L15.09 8.26"]')
    expect(starPaths.length).toBe(0)
  })

  it('MirAI 텍스트가 렌더링된다', () => {
    render(<Suspense><LoginPage /></Suspense>)
    expect(screen.getByText('MirAI')).toBeDefined()
  })

  it('MirAI 텍스트에 gradient-text 클래스가 적용된다', () => {
    render(<Suspense><LoginPage /></Suspense>)
    const miraiEl = screen.getByText('MirAI')
    expect(miraiEl.className).toContain('gradient-text')
  })

  it('w-9 h-9 rounded-[10px] 아이콘 컨테이너가 없다', () => {
    const { container } = render(<Suspense><LoginPage /></Suspense>)
    expect(container.querySelector('.w-9.h-9')).toBeNull()
  })
})

describe('Signup 페이지 — 로고 브랜딩', () => {
  it('MirAI 텍스트가 렌더링된다', () => {
    render(<SignupPage />)
    expect(screen.getByText('MirAI')).toBeDefined()
  })

  it('MirAI 텍스트에 gradient-text 클래스가 적용된다', () => {
    render(<SignupPage />)
    const miraiEl = screen.getByText('MirAI')
    expect(miraiEl.className).toContain('gradient-text')
  })

  it('w-9 h-9 rounded-[10px] 아이콘 컨테이너가 없다', () => {
    const { container } = render(<SignupPage />)
    expect(container.querySelector('.w-9.h-9')).toBeNull()
  })
})
