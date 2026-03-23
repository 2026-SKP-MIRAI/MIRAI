import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Open Redirect 방어
  const safeRedirect = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  // 익명 세션 마이그레이션 (RPC — 원자적 트랜잭션)
  const cookieStore = await cookies();
  const anonId = cookieStore.get("lww_anon_id")?.value;
  if (anonId) {
    const serviceClient = createServiceClient();
    const { error: migrateError } = await serviceClient.rpc("migrate_anon_to_user", {
      p_anon_id: anonId,
      p_user_id: data.user.id,
    });
    if (migrateError) {
      // 마이그레이션 실패는 치명적 오류가 아님 — 로그만 기록
      console.error("[auth/callback] 세션 마이그레이션 실패:", migrateError);
    }
  }

  const response = NextResponse.redirect(`${origin}${safeRedirect}`);
  if (anonId) {
    // 마이그레이션 후 쿠키 삭제 — 재로그인 시 중복 마이그레이션 방지
    response.cookies.delete("lww_anon_id");
  }
  return response;
}
