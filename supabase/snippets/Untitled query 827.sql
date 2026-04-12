-- Rename role label to coordinator while keeping backward-compatible DB helper.
-- This migration is for existing databases that already have 'card_coordinator'.

do $$
begin
  begin
    alter type public.user_role rename value 'card_coordinator' to 'coordinator';
  exception
    when invalid_parameter_value then
      -- Value already renamed; no-op.
      null;
  end;
end
$$;

create or replace function public.is_coordinator()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'coordinator'::public.user_role
  );
$$;

revoke all on function public.is_coordinator() from public;
grant execute on function public.is_coordinator() to authenticated;
grant execute on function public.is_coordinator() to service_role;

-- Compatibility shim for older policies/functions that still call is_card_coordinator().
create or replace function public.is_card_coordinator()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_coordinator();
$$;

revoke all on function public.is_card_coordinator() from public;
grant execute on function public.is_card_coordinator() to authenticated;
grant execute on function public.is_card_coordinator() to service_role;
