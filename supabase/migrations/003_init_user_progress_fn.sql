-- 003_init_user_progress_fn.sql
-- Initialize learner profile + mastery rows on first use

begin;

create or replace function public.init_user_progress()
returns void
language plpgsql
security definer
as $$
begin
  -- Create learner profile if missing
  insert into public.learner_profile (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  -- Seed mastery rows for all micro skills
  insert into public.mastery (user_id, micro_skill_id, mastery_score)
  select auth.uid(), ms.id, 0.30
  from public.micro_skills ms
  on conflict (user_id, micro_skill_id) do nothing;
end;
$$;

revoke all on function public.init_user_progress() from public;
grant execute on function public.init_user_progress() to authenticated;

commit;
