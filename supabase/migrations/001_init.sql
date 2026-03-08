-- 001_init.sql
-- Core content tables for LearnLoop Physics MVP

begin;

-- Topics
create table if not exists public.topics (
  id text primary key,
  name text not null,
  "order" integer not null,
  prerequisite_topic_ids jsonb not null default '[]'::jsonb
);

-- Micro skills
create table if not exists public.micro_skills (
  id text primary key,
  name text not null
);

-- Questions
create table if not exists public.questions (
  id text primary key,
  topic_id text not null references public.topics(id) on delete restrict,

  type text not null check (type in ('MCQ', 'NUMERIC', 'SETUP', 'EXPLAIN')),
  difficulty integer not null check (difficulty between 1 and 3),

  prompt text not null,

  -- MCQ fields
  choices jsonb,
  correct_choice_index integer,

  -- Display / grading
  correct_answer_text text not null,

  -- Numeric fields
  numeric_answer double precision,
  numeric_tolerance double precision,

  canonical_solution text not null,

  micro_skill_ids jsonb not null default '[]'::jsonb,
  misconceptions jsonb
);

-- Helpful indexes
create index if not exists idx_questions_topic_id on public.questions(topic_id);
create index if not exists idx_questions_type on public.questions(type);

commit;
