import { createServiceClient, createClient } from "@/lib/supabase/server";

export const COIN_REWARDS = {
  INTERVIEW_COMPLETE: 5, // .ai.md CONFIG 기준 (미확정, 추후 조정)
} as const;

export const DEFAULT_COINS = 0;

/**
 * 유저의 현재 코인 잔액 조회 (서버 사이드 전용)
 * - 오류 시 DEFAULT_COINS 반환 (non-fatal)
 */
export async function getUserCoins(userId: string): Promise<number> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("coins")
      .eq("id", userId)
      .single();
    if (error || !data) return DEFAULT_COINS;
    return data.coins ?? DEFAULT_COINS;
  } catch {
    return DEFAULT_COINS;
  }
}

/**
 * 면접 완료 코인 지급 (서버 사이드 전용)
 *
 * - non-fatal: 실패 시 throw 하지 않음
 * - 중복 지급 방지는 DB RPC award_coin이 보장 (unique index + FOR UPDATE)
 * - 반환: { awarded: true } | { awarded: false, reason: string }
 */
export async function awardInterviewCoin(
  userId: string,
  sessionId: string
): Promise<{ awarded: boolean; reason?: string }> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("award_coin", {
      p_user_id: userId,
      p_event_type: "interview_complete",
      p_ref_id: sessionId,
      p_amount: COIN_REWARDS.INTERVIEW_COMPLETE,
    });

    if (error) {
      console.error("[awardInterviewCoin] RPC 오류 (non-fatal):", error);
      return { awarded: false, reason: "rpc_error" };
    }

    return { awarded: data === true };
  } catch (err) {
    console.error("[awardInterviewCoin] 예외 (non-fatal):", err);
    return { awarded: false, reason: "exception" };
  }
}
