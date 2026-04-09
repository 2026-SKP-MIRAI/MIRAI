'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { loginAction, googleLoginAction } from './actions'

export default function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? ''
  const urlError = searchParams.get('error') === 'invalid_code'
    ? '인증 링크가 만료되었거나 이미 사용된 링크입니다. 다시 로그인해 주세요.'
    : null

  const [state, formAction, isPending] = useActionState(loginAction, null)

  const errorMessage = state?.error ?? urlError

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 1rem', background: 'var(--kwan-bg)', position: 'relative' }}>
      <Link
        href="/"
        style={{ position: 'absolute', top: '1.25rem', left: '1.5rem', color: 'var(--kwan-teal)', fontWeight: 700, fontSize: '1.125rem', textDecoration: 'none' }}
      >
        MirAI
      </Link>
      <div style={{ width: '100%', maxWidth: '24rem' }}>
        <div className="matte-card" style={{ padding: '2rem' }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3"
              style={{ background: 'var(--kwan-teal)' }}
            >
              <span style={{ color: 'var(--kwan-bg)', fontWeight: 800, fontSize: '1.25rem' }}>M</span>
            </div>
            <p style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--kwan-teal)' }}>MirAI</p>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--kwan-text)', marginTop: '0.25rem' }}>로그인</h1>
          </div>

          {errorMessage && (
            <div
              className="rounded-lg px-4 py-3 mb-4 text-sm"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: 'var(--kwan-error)' }}
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input type="hidden" name="redirectTo" value={redirectTo} />

            <div>
              <label htmlFor="login-email" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--kwan-text-2)', marginBottom: '0.375rem' }}>
                이메일
              </label>
              <input
                id="login-email"
                type="email"
                name="email"
                required
                disabled={isPending}
                autoComplete="email"
                placeholder="email@example.com"
                className="input-dark"
                style={{ padding: '0.75rem 0.875rem', opacity: isPending ? 0.5 : 1 }}
              />
            </div>

            <div>
              <label htmlFor="login-password" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--kwan-text-2)', marginBottom: '0.375rem' }}>
                비밀번호
              </label>
              <input
                id="login-password"
                type="password"
                name="password"
                required
                disabled={isPending}
                autoComplete="current-password"
                placeholder="비밀번호를 입력하세요"
                className="input-dark"
                style={{ padding: '0.75rem 0.875rem', opacity: isPending ? 0.5 : 1 }}
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="btn-primary"
              style={{ padding: '0.875rem', fontSize: '0.9375rem', marginTop: '0.5rem', width: '100%' }}
            >
              {isPending ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.25rem 0 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--kwan-border)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--kwan-text-muted)' }}>또는</span>
            <div style={{ flex: 1, height: 1, background: 'var(--kwan-border)' }} />
          </div>

          {/* Google OAuth */}
          <form action={googleLoginAction}>
            <button
              type="submit"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.625rem',
                padding: '0.75rem',
                marginTop: '0.75rem',
                background: 'var(--kwan-elevated)',
                border: '1px solid var(--kwan-border)',
                borderRadius: 'var(--kwan-radius-sm)',
                color: 'var(--kwan-text)',
                fontSize: '0.9375rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--kwan-border-hover)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--kwan-surface)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--kwan-border)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--kwan-elevated)' }}
            >
              {/* Google icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google로 로그인
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--kwan-text-2)' }}>
            계정이 없으신가요?{' '}
            <Link href="/signup" style={{ color: 'var(--kwan-teal)', fontWeight: 600, textDecoration: 'none' }}>
              회원가입 →
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
