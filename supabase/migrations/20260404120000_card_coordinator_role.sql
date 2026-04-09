-- Coordinator: bind ID cards across courses; no unbind (enforced in app + trigger).
-- Enum value is added in 20260404115900_coordinator_enum_value.sql (separate migration).

create or replace function public.is_coordinator()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'coordinator'::public.user_role
  );
$$;

revoke all on function public.is_coordinator() from public;
grant execute on function public.is_coordinator() to authenticated;
grant execute on function public.is_coordinator() to service_role;

-- Courses: full list for bind dropdown (same as admin bind UX).
create policy "Coordinators view all courses"
  on public.courses
  for select
  to authenticated
  using (public.is_coordinator());

-- Enrollments: roster for bind flow.
create policy "Coordinators view all enrollments"
  on public.enrollments
  for select
  to authenticated
  using (public.is_coordinator());

-- Profiles: coordinators see learners who have at least one enrollment (roster names; not full admin visibility).
drop policy if exists "Staff view learner profiles" on public.profiles;

create policy "Staff view learner profiles"
  on public.profiles
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.enrollments e
      join public.courses c on c.id = e.course_id
      where e.learner_id = profiles.id and c.instructor_id = auth.uid()
    )
    or exists (
      select 1 from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      join public.modules m on m.id = a.module_id
      join public.courses c on c.id = m.course_id
      where s.learner_id = profiles.id and c.instructor_id = auth.uid()
    )
    or (
      public.is_coordinator()
      and exists (select 1 from public.enrollments e where e.learner_id = profiles.id)
    )
  );

drop policy if exists "Staff read offline id cards" on public.offline_learner_id_cards;

create policy "Staff read offline id cards"
  on public.offline_learner_id_cards
  for select
  to authenticated
  using (
    public.is_admin()
    or public.is_coordinator()
    or (
      course_id is null
      or exists (
        select 1
        from public.courses c
        where c.id = offline_learner_id_cards.course_id
          and c.instructor_id = auth.uid()
      )
    )
  );

create policy "Coordinators update offline id cards for binding"
  on public.offline_learner_id_cards
  for update
  to authenticated
  using (public.is_coordinator())
  with check (public.is_coordinator());

-- Block unbind (clearing learner_id) for coordinators at the database layer.
create or replace function public.offline_learner_id_cards_block_coordinator_unbind()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.learner_id is not null
     and new.learner_id is null
     and public.is_coordinator() then
    raise exception 'coordinators cannot unbind id cards';
  end if;
  return new;
end;
$$;

revoke all on function public.offline_learner_id_cards_block_coordinator_unbind() from public;

drop trigger if exists offline_learner_id_cards_block_coordinator_unbind on public.offline_learner_id_cards;

create trigger offline_learner_id_cards_block_coordinator_unbind
  before update on public.offline_learner_id_cards
  for each row
  execute function public.offline_learner_id_cards_block_coordinator_unbind();
