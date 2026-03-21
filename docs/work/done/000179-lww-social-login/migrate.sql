-- LWW Phase 1 DB 마이그레이션
-- Supabase SQL Editor에서 실행: https://supabase.com/dashboard/project/fcrwejqinsmyyqpisepv/sql/new

-- ① interview_sessions
create table if not exists interview_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  anonymous_id    text not null,
  job_category    text not null,
  persona_id      uuid,
  status          text not null default 'in_progress'
                    check (status in ('in_progress', 'completed', 'abandoned')),
  questions       jsonb not null default '[]',
  answers         jsonb not null default '[]',
  history         jsonb not null default '[]',
  questions_queue jsonb not null default '[]',
  report_id       uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table interview_sessions enable row level security;

-- ② reports
create table if not exists reports (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references interview_sessions(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete set null,
  anonymous_id   text not null,
  status         text not null default 'processing'
                   check (status in ('processing', 'completed', 'failed')),
  total_score    integer,
  axis_scores    jsonb,
  axis_feedbacks jsonb,
  summary        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table reports enable row level security;

-- ③ profiles
create table if not exists profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  name                 text,
  avatar_url           text,
  type                 text not null default 'jobseeker'
                         check (type in ('jobseeker', 'professional', 'ai_persona')),
  job_category         text,
  prep_stage           text,
  coins                integer not null default 0,
  streak               integer not null default 0,
  last_active_at       timestamptz,
  onboarding_completed boolean not null default false,
  verification_status  text not null default 'none'
                         check (verification_status in (
                           'none', 'email_verified', 'document_pending', 'document_verified'
                         )),
  verified_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
alter table profiles enable row level security;

create policy "read own profile"
  on profiles for select to authenticated
  using (id = auth.uid());

create policy "update own profile"
  on profiles for update to authenticated
  using (id = auth.uid());

create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ④ migrate_anon_to_user RPC
create or replace function migrate_anon_to_user(p_anon_id text, p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  update interview_sessions set user_id = p_user_id
    where anonymous_id = p_anon_id and user_id is null;
  update reports set user_id = p_user_id
    where anonymous_id = p_anon_id and user_id is null;
end;
$$;
