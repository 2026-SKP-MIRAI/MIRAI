import { describe, it, expect, vi, beforeEach } from "vitest";

// Supabase server mock
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "@/lib/supabase/server";
import { awardInterviewCoin, COIN_REWARDS } from "../credit";

const mockCreateServiceClient = vi.mocked(createServiceClient);

describe("awardInterviewCoin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("RPC가 true를 반환하면 awarded: true를 반환한다", async () => {
    mockCreateServiceClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    } as unknown as ReturnType<typeof createServiceClient>);

    const result = await awardInterviewCoin("user-uuid", "session-uuid");

    expect(result).toEqual({ awarded: true });
  });

  it("RPC가 false를 반환하면 awarded: false를 반환한다 (중복 또는 캡 초과)", async () => {
    mockCreateServiceClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    } as unknown as ReturnType<typeof createServiceClient>);

    const result = await awardInterviewCoin("user-uuid", "session-uuid");

    expect(result).toEqual({ awarded: false });
  });

  it("RPC 오류 시 throw 없이 awarded: false를 반환한다", async () => {
    mockCreateServiceClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "DB error", code: "PGRST116" },
      }),
    } as unknown as ReturnType<typeof createServiceClient>);

    const result = await awardInterviewCoin("user-uuid", "session-uuid");

    expect(result.awarded).toBe(false);
    expect(result.reason).toBe("rpc_error");
  });

  it("예외 발생 시 throw 없이 awarded: false를 반환한다", async () => {
    mockCreateServiceClient.mockReturnValue({
      rpc: vi.fn().mockRejectedValue(new Error("Network error")),
    } as unknown as ReturnType<typeof createServiceClient>);

    const result = await awardInterviewCoin("user-uuid", "session-uuid");

    expect(result.awarded).toBe(false);
    expect(result.reason).toBe("exception");
  });

  it("COIN_REWARDS.INTERVIEW_COMPLETE는 5이다", () => {
    expect(COIN_REWARDS.INTERVIEW_COMPLETE).toBe(5);
  });

  it("RPC 호출 시 올바른 파라미터를 전달한다", async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: true, error: null });
    mockCreateServiceClient.mockReturnValue({
      rpc: mockRpc,
    } as unknown as ReturnType<typeof createServiceClient>);

    await awardInterviewCoin("user-123", "session-456");

    expect(mockRpc).toHaveBeenCalledWith("award_coin", {
      p_user_id: "user-123",
      p_event_type: "interview_complete",
      p_ref_id: "session-456",
      p_amount: COIN_REWARDS.INTERVIEW_COMPLETE,
    });
  });
});
