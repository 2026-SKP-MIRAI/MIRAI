import { Suspense } from 'react'
import SignupForm from './SignupForm'

export const metadata = {
  title: '회원가입 | MirAI',
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center px-4 bg-grid">
          <div className="w-full max-w-sm sm:max-w-md rounded-2xl p-8 glass-card">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1a1a2e] mb-3">
                <span className="text-white text-xl font-bold">M</span>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  )
}
