import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

/**
 * 인증 컨텍스트를 반환합니다.
 * - 로그인 사용자: { user, userId: user.id, isGuest: false }
 * - 비회원 모드(__guest 쿠키): { user: null, userId: null, isGuest: true }
 * - 미인증: { user: null, userId: null, isGuest: false }
 */
export async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return { user, userId: user.id, isGuest: false }

  const cookieStore = await cookies()
  if (cookieStore.get('__guest')?.value === '1') {
    return { user: null, userId: null as string | null, isGuest: true }
  }
  return { user: null, userId: null as string | null, isGuest: false }
}
