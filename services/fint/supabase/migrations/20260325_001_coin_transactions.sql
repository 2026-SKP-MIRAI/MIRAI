-- [#181] Phase 1 — 코인 시스템 기초: coin_transactions 테이블 + award_coin RPC
-- 주의: profiles 테이블은 이슈 #179에서 이미 생성됨 (coins 컬럼 포함)

-- 1. coin_transactions 테이블
create table if not exists coin_transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     integer not null,
  event_type text not null,  -- 'interview_complete' | 'profile_complete' | ...
  ref_id     uuid,           -- session_id, persona_id 등 관련 엔티티 id
  created_at timestamptz not null default now()
);

-- 2. 중복 지급 방지 index: 동일 유저 + 이벤트 타입 + ref_id 조합 unique
create unique index if not exists uq_coin_tx_event
  on coin_transactions (user_id, event_type, ref_id)
  where ref_id is not null;

-- 3. 조회 성능 index
create index if not exists idx_coin_tx_user_date
  on coin_transactions (user_id, created_at);

-- 4. RLS
alter table coin_transactions enable row level security;

create policy "read own transactions"
  on coin_transactions for select to authenticated
  using (user_id = auth.uid());

-- 5. award_coin RPC: 코인 지급 (원자적, 비즈니스 룰 포함)
-- SECURITY DEFINER: service_role 권한으로 실행 (RLS 우회)
create or replace function award_coin(
  p_user_id    uuid,
  p_event_type text,
  p_ref_id     uuid,
  p_amount     integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type         text;
  v_daily_earned integer;
  v_daily_cap    integer := 50;  -- 미확정, 추후 조정 가능
  v_inserted     integer;
begin
  -- 0. 동일 유저의 동시 요청 직렬화 (daily cap TOCTOU race condition 방지)
  perform 1 from profiles where id = p_user_id for update;

  -- 1. AI 페르소나 계정 제외 (크레딧 집계 오염 방지)
  select type into v_type from profiles where id = p_user_id;
  if v_type = 'ai_persona' then
    return false;
  end if;

  -- 2. 일일 획득 상한 체크 (어뷰징 방지)
  select coalesce(sum(amount), 0) into v_daily_earned
  from coin_transactions
  where user_id = p_user_id
    and created_at >= current_date
    and amount > 0;

  if v_daily_earned >= v_daily_cap then
    return false;
  end if;

  -- 3. 중복 방지 INSERT (이미 지급된 세션이면 skip)
  with ins as (
    insert into coin_transactions (user_id, amount, event_type, ref_id)
    values (p_user_id, p_amount, p_event_type, p_ref_id)
    on conflict (user_id, event_type, ref_id) where ref_id is not null
    do nothing
    returning id
  )
  select count(*) into v_inserted from ins;

  if v_inserted = 0 then
    return false;  -- 이미 지급된 세션
  end if;

  -- 4. profiles.coins 잔액 원자적 갱신
  update profiles
  set coins      = coins + p_amount,
      updated_at = now()
  where id = p_user_id;

  return true;
end;
$$;

-- 6. 보안: anon/authenticated에서 award_coin 직접 호출 금지 (서버 사이드 전용)
revoke all on function award_coin(uuid, text, uuid, integer) from anon, authenticated;
grant execute on function award_coin(uuid, text, uuid, integer) to service_role;
