import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AuthLayout from '../layout'

// next/link mock
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

describe('AuthLayout', () => {
  it('좌상단에 MirAI 로고가 렌더링된다', () => {
    render(<AuthLayout><div>child</div></AuthLayout>)
    const logo = screen.getByText('MirAI')
    expect(logo).toBeDefined()
    expect(logo.closest('a')).toBeDefined()
    expect(logo.closest('a')?.getAttribute('href')).toBe('/')
  })

  it('로고에 gradient-text 클래스가 적용된다', () => {
    render(<AuthLayout><div>child</div></AuthLayout>)
    const logo = screen.getByText('MirAI')
    expect(logo.closest('a')?.className).toContain('gradient-text')
  })

  it('children이 정상적으로 렌더링된다', () => {
    render(<AuthLayout><div data-testid="child">test content</div></AuthLayout>)
    expect(screen.getByTestId('child')).toBeDefined()
  })
})
