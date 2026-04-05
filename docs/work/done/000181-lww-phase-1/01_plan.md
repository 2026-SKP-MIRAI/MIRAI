# [#181] feat: [fint] Phase 1 — 크레딧 시스템 기초 (획득 전용) — 구현 계획

> 작성: 2026-03-25
> ralplan 컨센서스 (Planner → Architect → Critic ITERATE → 수정)

---

## 완료 기준 (이슈 AC → spec 명칭으로 정렬)

- [ ] 면접 완료(리포트 생성) 시 코인 자동 지급 (세션당 1회, 중복 지급 방지)
- [ ] `coin_transactions` 테이블에 지급 내역 기록 (`user_id + event_type + ref_id` 복합 unique)
- [ ] `profiles.coins` 잔액 갱신 (원자적)
- [ ] UI에서 현재 코인 잔액 표시 (인터뷰 탭 header)
- [ ] 비로그인 유저는 코인 지급 없음
- [ ] AI 페르소나 계정 코인 집계 제외 (`profiles.type = 'ai_persona'` 체크)
- [ ] 일일 획득 상한 적용 (어뷰징 방지)

---

## ADR (결정 기록)

**Decision:** Supabase RPC function (`award_coin`) 방식으로 코인 지급

**Drivers:**
1. 원자성 — AI 페르소나 체크 + 일일 캡 체크 + INSERT + coins UPDATE가 단일 트랜잭션
2. 비즈니스 룰 강제 — 일일 상한, AI 페르소나 제외를 DB 레벨에서 보장
3. 명확한 반환값 — `BOOLEAN` 반환으로 "지급됨 / 이미 지급 / 캡 초과 / 제외 대상" 구분

**Rejected:**
- DB trigger (INSERT → balance 자동 갱신): 비즈니스 룰(일일 캡)을 trigger에 넣기 어렵고, pre-condition 강제 불가
- 2-step write (INSERT + UPDATE 별도): partial failure 시 잔액 불일치 위험

**Naming:** dev_spec.md 기준 준수 — `coin_transactions`, `event_type`, `ref_id`, `profiles.coins`

**Note (credit amount):** `.ai.md`의 `CREDIT_INTERVIEW_COMPLETE = 5` 사용. 일일 캡은 `DAILY_COIN_CAP = 50` (미확정 — 추후 조정)

---

## 구현 계획

### Step 1: DB 마이그레이션 — `coin_transactions` 테이블 + RPC

**파일 생성:**
- `services/fint/supabase/migrations/20260325_001_coin_transactions.sql`

> **주의:** `profiles` 테이블은 이슈 #179 마이그레이션에서 이미 생성됨 (`coins` 컬럼 포함). 이 마이그레이션은 `coin_transactions` 테이블만 추가.

**SQL 내용:**

```sql
-- coin_transactions 테이블
create table if not exists coin_transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     integer not null,
  event_type text not null,  -- 'interview_complete' | 'profile_complete' | ...
  ref_id     uuid,           -- session_id, persona_id 등
  created_at timestamptz not null default now()
);

-- 중복 지급 방지: 동일 유저 + 이벤트 타입 + 참조 ID 조합 unique
create unique index if not exists uq_coin_tx_event
  on coin_transactions (user_id, event_type, ref_id)
  where ref_id is not null;

create index if not exists idx_coin_tx_user_date
  on coin_transactions (user_id, created_at);

-- RLS
alter table coin_transactions enable row level security;

create policy "read own transactions"
  on coin_transactions for select to authenticated
  using (user_id = auth.uid());

-- RPC: 코인 지급 (원자적, 비즈니스 룰 포함)
-- SECURITY DEFINER: service_role 권한으로 실행 (RLS 우회)
create or replace function award_coin(
  p_user_id   uuid,
  p_event_type text,
  p_ref_id    uuid,
  p_amount    integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type         text;
  v_daily_earned integer;
  v_daily_cap    integer := 50;  -- 미확정, 추후 조정
  v_inserted     integer;
begin
  -- 0. 동일 유저의 동시 요청 직렬화 (daily cap TOCTOU 방지)
  perform 1 from profiles where id = p_user_id for update;

  -- 1. AI 페르소나 계정 제외
  select type into v_type from profiles where id = p_user_id;
  if v_type = 'ai_persona' then
    return false;
  end if;

  -- 2. 일일 획득 상한 체크
  select coalesce(sum(amount), 0) into v_daily_earned
  from coin_transactions
  where user_id = p_user_id
    and created_at >= current_date
    and amount > 0;

  if v_daily_earned >= v_daily_cap then
    return false;
  end if;

  -- 3. 중복 방지 INSERT (이미 지급된 경우 skip)
  with ins as (
    insert into coin_transactions (user_id, amount, event_type, ref_id)
    values (p_user_id, p_amount, p_event_type, p_ref_id)
    on conflict (user_id, event_type, ref_id) where ref_id is not null
    do nothing
    returning id
  )
  select count(*) into v_inserted from ins;

  if v_inserted = 0 then
    return false;  -- 이미 지급됨
  end if;

  -- 4. 잔액 갱신
  update profiles
  set coins = coins + p_amount,
      updated_at = now()
  where id = p_user_id;

  return true;
end;
$$;

-- RPC 직접 호출 방지 (anon role에서 호출 불가)
revoke all on function award_coin(uuid, text, uuid, integer) from anon, authenticated;
grant execute on function award_coin(uuid, text, uuid, integer) to service_role;
```

**검증:**
- `coin_transactions` 테이블 생성 확인
- `uq_coin_tx_event` unique index 확인
- `award_coin` RPC 존재 확인
- RLS 활성화 확인

---

### Step 2: 크레딧 상수 + 헬퍼 함수

**파일 생성:**
- `services/fint/src/lib/credit.ts`

```typescript
import { createServiceClient } from "@/lib/supabase/server";

export const COIN_REWARDS = {
  INTERVIEW_COMPLETE: 5,  // 미확정, .ai.md CONFIG 기준
} as const;

// DAILY_COIN_CAP은 DB RPC 내부 상수(50)와 동기화
// 서버 코드에서는 별도 체크 불필요 (RPC가 보장)

/**
 * 면접 완료 코인 지급 (서버 사이드 전용)
 * - non-fatal: 실패해도 throw 하지 않음
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
```

**검증:**
- `awardInterviewCoin` export 확인
- 중복 세션 → `awarded: false` 반환 (throw 없음)
- DB 에러 → `awarded: false` 반환 (throw 없음)

---

### Step 3: `/api/interview/end` 수정

**파일 수정:**
- `services/fint/src/app/api/interview/end/route.ts`

**변경 내용:**

`awardInterviewCoin` import 추가:
```typescript
import { awardInterviewCoin } from "@/lib/credit";
```

report INSERT 성공 블록(`reportRow` 존재) + `userId` 존재 조건에서 크레딧 지급:
```typescript
// 기존 session UPDATE 직후, return Response.json({ report }) 직전에 삽입
if (reportRow && userId) {
  await awardInterviewCoin(userId, sessionId);
  // 결과는 non-fatal — 실패해도 report 응답에 영향 없음
}
```

응답에 `coinAwarded` 포함 (UI 피드백용, optional):
```typescript
return Response.json({ report });
// → report 응답 변경 없음 (코인 지급 결과는 노출 안 함, UI는 profiles 조회)
```

**검증:**
- 로그인 유저 면접 완료 → `coin_transactions` 행 생성 확인
- 동일 세션 재요청 → 중복 행 없음 확인
- 비로그인 유저 → `userId`가 null이므로 `awardInterviewCoin` 미호출 확인
- 크레딧 지급 실패 → report 응답 정상 반환 확인

---

### Step 4: 잔액 조회 API

**파일 생성:**
- `services/fint/src/app/api/coins/balance/route.ts`

```typescript
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/get-current-user-id";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ coins: null });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("coins")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return Response.json({ coins: 0 });
  }

  return Response.json({ coins: data.coins });
}
```

**경로:** `/api/coins/balance` (dev_spec.md:200 기준)

**검증:**
- 로그인 → `{ coins: number }` 반환
- 비로그인 → `{ coins: null }` 반환
- profiles 없음 → `{ coins: 0 }` 반환

---

### Step 5: CreditBadge UI + InterviewPage 통합

**파일 생성:**
- `services/fint/src/components/credit/CreditBadge.tsx`

```tsx
// Server Component — InterviewPage에서 서버 사이드로 coins 조회
import { Coins } from "lucide-react";

interface CreditBadgeProps {
  coins: number;
}

export function CreditBadge({ coins }: CreditBadgeProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border border-amber-200">
      <Coins className="w-4 h-4 text-amber-600" aria-hidden="true" />
      <span className="text-sm font-bold text-amber-900">{coins}</span>
    </div>
  );
}
```

**접근성 주의:** Coin Amber(`#F59E0B`)는 아이콘/배경에만 사용. 텍스트는 `text-amber-900` (WCAG AA 충족).

**파일 수정:**
- `services/fint/src/app/(main)/interview/page.tsx`

InterviewPage는 이미 서버 컴포넌트이고 `user` 정보를 갖고 있음 → 추가 API 호출 없이 profiles 조회:

```tsx
// 기존 user 체크 직후 coins 조회 추가
let coins: number | null = null;
if (user) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("coins")
    .eq("id", user.id)
    .single();
  coins = profile?.coins ?? 0;
}
```

header 수정 — "+ 새 면접" 링크 왼쪽에 CreditBadge 삽입:
```tsx
<div className="flex items-center gap-3 pr-5">
  {coins !== null && <CreditBadge coins={coins} />}
  <Link href="/onboarding" className="text-sm font-bold text-[#0D9488] whitespace-nowrap">
    + 새 면접
  </Link>
</div>
```

**검증:**
- 로그인 유저: 코인 배지 표시
- 비로그인 유저: 배지 미표시
- 잔액 0: "0" 표시 (빈 화면 아님)

---

### Step 6: 테스트

**파일 생성:**
- `services/fint/src/app/api/interview/end/__tests__/credit.test.ts`
- `services/fint/src/lib/__tests__/credit.test.ts`

**테스트 케이스:**

`awardInterviewCoin`:
1. 정상 지급 → `{ awarded: true }` 반환 (RPC mock)
2. 중복 session_id → `{ awarded: false }` 반환 (RPC returns false)
3. AI 페르소나 → `{ awarded: false }` 반환 (RPC returns false)
4. 일일 캡 초과 → `{ awarded: false }` 반환
5. DB 오류 → throw 없이 `{ awarded: false }` 반환

`/api/interview/end`:
6. 로그인 유저 + report 성공 → `awardInterviewCoin` 호출됨
7. 비로그인 유저 → `awardInterviewCoin` 미호출 (userId null)
8. 크레딧 지급 실패해도 → report 200 정상 반환

`/api/coins/balance`:
9. 로그인 유저 → `{ coins: number }` 반환
10. 비로그인 유저 → `{ coins: null }` 반환

---

## 파일 변경 요약

| 구분 | 파일 | 작업 |
|------|------|------|
| 생성 | `services/fint/supabase/migrations/20260325_001_coin_transactions.sql` | coin_transactions 테이블 + RPC |
| 생성 | `services/fint/src/lib/credit.ts` | 코인 상수 + 지급 헬퍼 |
| 수정 | `services/fint/src/app/api/interview/end/route.ts` | 크레딧 지급 호출 추가 |
| 생성 | `services/fint/src/app/api/coins/balance/route.ts` | 잔액 조회 API |
| 생성 | `services/fint/src/components/credit/CreditBadge.tsx` | 코인 배지 UI |
| 수정 | `services/fint/src/app/(main)/interview/page.tsx` | header에 CreditBadge 삽입 |
| 생성 | `services/fint/src/lib/__tests__/credit.test.ts` | 헬퍼 단위 테스트 |
| 생성 | `services/fint/src/app/api/interview/end/__tests__/credit.test.ts` | route 통합 테스트 |
| 수정 | `services/fint/.ai.md` | 크레딧 시스템 구현 현황 추가 |

---

## 엣지 케이스 및 주의사항

- **`profiles` 없는 유저**: #179 마이그레이션의 `handle_new_user` trigger가 auth.users INSERT 시 자동 생성. 단, 기존 유저 중 profiles 없는 경우 백필 필요 (이미 #179 마이그레이션에 `INSERT INTO profiles SELECT id FROM auth.users ON CONFLICT DO NOTHING` 포함됨).
- **일일 캡 값**: 현재 DB RPC 내부 상수 `50`. 추후 환경변수 또는 어드민 설정으로 이전 가능.
- **코인 획득량**: `COIN_REWARDS.INTERVIEW_COMPLETE = 5` (미확정). `.ai.md` CONFIG 업데이트 시 동기화 필요.
- **Phase 2 확장**: 코인 차감 시 `profiles.coins >= 0` CHECK 없음 (spec 미명시) — 차감 로직은 별도 RPC로 추가.
- **`services/lww/.ai.md` 참조**: 이슈 checklist의 `services/lww/.ai.md`는 `services/fint/.ai.md`로 수정 필요 (#194에서 서비스명 변경됨).
