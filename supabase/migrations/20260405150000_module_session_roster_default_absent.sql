-- Roster rows default to absent; manual hub shows everyone "Present" in UI until submit.
-- ID scan resets to absent when camera starts (only if attendance not yet submitted).

alter table public.module_session_roster
  alter column is_present set default false;

update public.module_session_roster msr
set is_present = false
where msr.roster_submitted_at is null
  and msr.is_present = true;
