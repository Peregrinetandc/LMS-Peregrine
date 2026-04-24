-- Fix privilege errors on normalized module subtype tables.
-- RLS policies already exist; this migration restores table-level privileges
-- so authenticated users can pass through RLS checks.

begin;

grant select, insert, update, delete on table public.module_content to authenticated;
grant select, insert, update, delete on table public.module_session to authenticated;
grant select, insert, update, delete on table public.module_quiz_settings to authenticated;

commit;
