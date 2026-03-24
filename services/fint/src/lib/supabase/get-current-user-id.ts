import { createClient } from "./server";

/**
 * 현재 요청의 로그인 사용자 ID를 반환한다.
 * 비로그인이거나 인증 오류 시 null 반환 — 익명 기능은 정상 동작 유지.
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}
