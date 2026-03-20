import { redirect } from 'next/navigation'

/**
 * 루트(/)는 로그인 후 대시보드 진입 경로인 /dashboard로 리다이렉트.
 * (이슈 #157 — 미인증 시 middleware가 /login으로 보냄)
 */
export default function Home() {
  redirect('/dashboard')
}
