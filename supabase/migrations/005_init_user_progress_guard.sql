-- 005_init_user_progress_guard.sql
-- Add guard to init_user_progress to ensure auth.uid() is not null

begin;

create or replace function public.init_user_progress()
returns void
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'init_user_progress requires an authenticated user (auth.uid() is null)';
  end if;

  insert into public.learner_profile (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  insert into public.mastery (user_id, micro_skill_id, mastery_score)
  select v_user_id, ms.id, 0.30
  from public.micro_skills ms
  on conflict (user_id, micro_skill_id) do nothing;
end;
$$;

revoke all on function public.init_user_progress() from public;
grant execute on function public.init_user_progress() to authenticated;

commit;