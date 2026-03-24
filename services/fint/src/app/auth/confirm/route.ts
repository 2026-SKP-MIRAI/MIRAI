import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  // Open Redirect 방어
  const safeRedirect = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!token_hash || !type) {
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash, type });

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  // 익명 세션 마이그레이션 (RPC — 원자적 트랜잭션)
  // verifyOtp는 user를 직접 반환하지 않으므로 getUser() 별도 호출
  const cookieStore = await cookies();
  const anonId = cookieStore.get("lww_anon_id")?.value;
  if (anonId) {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const serviceClient = createServiceClient();
      const { error: migrateError } = await serviceClient.rpc("migrate_anon_to_user", {
        p_anon_id: anonId,
        p_user_id: userData.user.id,
      });
      if (migrateError) {
        // 마이그레이션 실패는 치명적 오류가 아님 — 로그만 기록
        console.error("[auth/confirm] 세션 마이그레이션 실패:", migrateError);
      }
    }
  }

  const response = NextResponse.redirect(`${origin}${safeRedirect}`);
  if (anonId) {
    // 마이그레이션 후 쿠키 삭제 — 재로그인 시 중복 마이그레이션 방지
    response.cookies.delete("lww_anon_id");
  }
  return response;
}
