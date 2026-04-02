-- Mirror auth email on profiles for staff UIs (e.g. disambiguate learners by name).

alter table public.profiles
  add column if not exists email text;

comment on column public.profiles.email is 'Copied from auth.users.email on signup; backfilled for existing users.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, email)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    'learner',
    new.email
  );
  return new;
end;
$$;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and (p.email is null or p.email is distinct from u.email);
