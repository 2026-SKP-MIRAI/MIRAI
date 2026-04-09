'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export async function googleLoginAction() {
  const headersList = await headers()
  const origin = headersList.get('origin') ?? 'http://localhost:3001'

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error || !data.url) return { error: '구글 로그인 중 오류가 발생했습니다.' }
  redirect(data.url)
}

export async function signupAction(_prevState: unknown, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const headerStore = await headers()
  const origin = headerStore.get('origin') ?? ''

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  })

  if (error) return { error: '회원가입에 실패했습니다. 다시 시도해 주세요.' }
  return { success: true as const, email }
}
