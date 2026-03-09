export const metadata = {
  title: 'MirAI — 자소서 면접 질문 생성',
  description: '자소서를 업로드하면 AI가 면접 예상 질문을 카테고리별로 생성해드립니다.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
