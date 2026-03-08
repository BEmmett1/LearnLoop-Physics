-- 002_user_progress.sql
-- User progress tables + Row Level Security (RLS) policies

begin;

-- 1) Learner profile
create table if not exists public.learner_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_goal text not null default 'HIGH_SCHOOL_PHYSICS_KINEMATICS',
  preferred_pace_minutes integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_learner_profile_user_id on public.learner_profile(user_id);

-- 2) Sessions (each practice session)
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  mode text not null default 'LESSON' check (mode in ('DIAGNOSTIC', 'LESSON', 'REVIEW'))
);

create index if not exists idx_sessions_user_id on public.sessions(user_id);
create index if not exists idx_sessions_started_at on public.sessions(started_at);

-- 3) Attempts (each question attempt)
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  question_id text not null references public.questions(id) on delete restrict,

  correct boolean not null,
  response jsonb,
  seconds_spent integer not null default 0,
  hints_used integer not null default 0,
  misconception_tag text,

  created_at timestamptz not null default now()
);

create index if not exists idx_attempts_user_id on public.attempts(user_id);
create index if not exists idx_attempts_question_id on public.attempts(question_id);
create index if not exists idx_attempts_created_at on public.attempts(created_at);
create index if not exists idx_attempts_session_id on public.attempts(session_id);

-- 4) Mastery (per user, per micro-skill)
create table if not exists public.mastery (
  user_id uuid not null references auth.users(id) on delete cascade,
  micro_skill_id text not null references public.micro_skills(id) on delete restrict,
  mastery_score double precision not null default 0.30 check (mastery_score >= 0 and mastery_score <= 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, micro_skill_id)
);

create index if not exists idx_mastery_user_id on public.mastery(user_id);
create index if not exists idx_mastery_micro_skill_id on public.mastery(micro_skill_id);

-- Optional: keep updated_at fresh on updates
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_learner_profile_updated_at on public.learner_profile;
create trigger trg_learner_profile_updated_at
before update on public.learner_profile
for each row execute function public.set_updated_at();

drop trigger if exists trg_mastery_updated_at on public.mastery;
create trigger trg_mastery_updated_at
before update on public.mastery
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Row Level Security (RLS)
-- ------------------------------------------------------------

-- learner_profile
alter table public.learner_profile enable row level security;

drop policy if exists learner_profile_select_own on public.learner_profile;
create policy learner_profile_select_own
on public.learner_profile
for select
using (user_id = auth.uid());

drop policy if exists learner_profile_insert_own on public.learner_profile;
create policy learner_profile_insert_own
on public.learner_profile
for insert
with check (user_id = auth.uid());

drop policy if exists learner_profile_update_own on public.learner_profile;
create policy learner_profile_update_own
on public.learner_profile
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists learner_profile_delete_own on public.learner_profile;
create policy learner_profile_delete_own
on public.learner_profile
for delete
using (user_id = auth.uid());

-- sessions
alter table public.sessions enable row level security;

drop policy if exists sessions_select_own on public.sessions;
create policy sessions_select_own
on public.sessions
for select
using (user_id = auth.uid());

drop policy if exists sessions_insert_own on public.sessions;
create policy sessions_insert_own
on public.sessions
for insert
with check (user_id = auth.uid());

drop policy if exists sessions_update_own on public.sessions;
create policy sessions_update_own
on public.sessions
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists sessions_delete_own on public.sessions;
create policy sessions_delete_own
on public.sessions
for delete
using (user_id = auth.uid());

-- attempts
alter table public.attempts enable row level security;

drop policy if exists attempts_select_own on public.attempts;
create policy attempts_select_own
on public.attempts
for select
using (user_id = auth.uid());

drop policy if exists attempts_insert_own on public.attempts;
create policy attempts_insert_own
on public.attempts
for insert
with check (user_id = auth.uid());

drop policy if exists attempts_update_own on public.attempts;
create policy attempts_update_own
on public.attempts
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists attempts_delete_own on public.attempts;
create policy attempts_delete_own
on public.attempts
for delete
using (user_id = auth.uid());

-- mastery
alter table public.mastery enable row level security;

drop policy if exists mastery_select_own on public.mastery;
create policy mastery_select_own
on public.mastery
for select
using (user_id = auth.uid());

drop policy if exists mastery_insert_own on public.mastery;
create policy mastery_insert_own
on public.mastery
for insert
with check (user_id = auth.uid());

drop policy if exists mastery_update_own on public.mastery;
create policy mastery_update_own
on public.mastery
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists mastery_delete_own on public.mastery;
create policy mastery_delete_own
on public.mastery
for delete
using (user_id = auth.uid());

commit;
