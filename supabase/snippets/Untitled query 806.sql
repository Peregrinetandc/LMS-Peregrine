-- Fix module subtype trigger flow:
-- the prior constraint trigger required subtype rows to exist at module insert time,
-- which fails in app flows that insert module first then upsert subtype rows.

begin;

drop trigger if exists trg_enforce_module_subtype_integrity on public.modules;
drop function if exists public.enforce_module_subtype_integrity();

create or replace function public.ensure_module_subtype_rows()
returns trigger
language plpgsql
as $$
begin
  -- Keep subtype rows aligned with module type and create placeholders eagerly.
  if new.type in ('video', 'document', 'live_session') then
    insert into public.module_content (module_id, content_url)
    values (new.id, null)
    on conflict (module_id) do nothing;
  else
    delete from public.module_content where module_id = new.id;
  end if;

  if new.type in ('live_session', 'offline_session') then
    insert into public.module_session (module_id, session_location, session_start_at, session_end_at)
    values (new.id, null, null, null)
    on conflict (module_id) do nothing;
  else
    delete from public.module_session where module_id = new.id;
  end if;

  if new.type in ('quiz', 'mcq') then
    insert into public.module_quiz_settings (
      module_id,
      quiz_passing_pct,
      quiz_allow_retest,
      quiz_time_limit_minutes,
      quiz_randomize_questions
    )
    values (new.id, 60, true, null, false)
    on conflict (module_id) do nothing;
  else
    delete from public.module_quiz_settings where module_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ensure_module_subtype_rows on public.modules;
create trigger trg_ensure_module_subtype_rows
before insert or update of type
on public.modules
for each row
execute function public.ensure_module_subtype_rows();

commit;
