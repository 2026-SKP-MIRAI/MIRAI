'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export async function loginAction(_prevState: unknown, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = formData.get('redirectTo') as string | null

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' }

  const safePath = redirectTo?.startsWith('/') && !redirectTo.startsWith('//')
    ? redirectTo
    : '/dashboard'
  redirect(safePath)
}

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
