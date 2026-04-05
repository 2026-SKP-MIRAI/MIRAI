import { getCurrentUserId } from "@/lib/supabase/get-current-user-id";
import { getUserCoins } from "@/lib/credit";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ coins: null });
  const coins = await getUserCoins(userId);
  return Response.json({ coins });
}
