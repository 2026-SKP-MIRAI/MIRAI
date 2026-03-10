import { redirect } from 'next/navigation'

/**
 * 루트(/)는 MVP 명세(docs/specs/mvp/dev_spec.md §7-2)에 따라
 * 자소서·질문 생성 플로우 진입 경로인 /resume로 리다이렉트.
 */
export default function Home() {
  redirect('/resume')
}
