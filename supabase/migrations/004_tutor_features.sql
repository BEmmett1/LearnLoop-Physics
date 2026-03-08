-- 004_tutor_features.sql
-- Add columns to support tutor features

begin;

alter table public.questions
add column if not exists hints jsonb;

-- Add attempt metadata to support tutor behaviors
alter table public.attempts
add column if not exists started_at_ms bigint,
add column if not exists ended_at_ms bigint,
add column if not exists careless boolean not null default false;

commit;
