import type { Metadata } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "KWAN — 자소서 기반 모의면접",
  description: "자소서를 업로드하면 맞춤 예상 질문을 생성해드립니다.",
};

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const isGuest = !user && cookieStore.get('__guest')?.value === '1';

  return (
    <html lang="ko">
      <body
        style={{ background: 'var(--kwan-bg)', color: 'var(--kwan-text)' }}
      >
        {(user || isGuest) && <NavBar onSignOut={user ? signOut : undefined} />}
        {children}
      </body>
    </html>
  );
}
