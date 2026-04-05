-- Offline physical ID cards: bind to a learner only (no course_id on the row).

drop policy if exists "Staff read offline id cards" on public.offline_learner_id_cards;
drop policy if exists "Instructors update offline id cards for their courses" on public.offline_learner_id_cards;

drop index if exists public.offline_learner_id_cards_learner_course_active_key;

alter table public.offline_learner_id_cards drop column if exists course_id;

create unique index offline_learner_id_cards_learner_active_key
  on public.offline_learner_id_cards (learner_id)
  where learner_id is not null;

create policy "Staff read offline id cards"
  on public.offline_learner_id_cards
  for select
  to authenticated
  using (
    public.is_admin()
    or public.is_card_coordinator()
    or (
      learner_id is null
      or exists (
        select 1
        from public.enrollments e
        join public.courses c on c.id = e.course_id
        where e.learner_id = offline_learner_id_cards.learner_id
          and c.instructor_id = auth.uid()
      )
    )
  );

create policy "Instructors update offline id cards for their courses"
  on public.offline_learner_id_cards
  for update
  to authenticated
  using (
    not public.is_admin()
    and (
      learner_id is null
      or exists (
        select 1
        from public.enrollments e
        join public.courses c on c.id = e.course_id
        where e.learner_id = offline_learner_id_cards.learner_id
          and c.instructor_id = auth.uid()
      )
    )
  )
  with check (
    not public.is_admin()
    and (
      (
        learner_id is null
        and bound_at is null
        and bound_by is null
      )
      or exists (
        select 1
        from public.enrollments e
        join public.courses c on c.id = e.course_id
        where e.learner_id = offline_learner_id_cards.learner_id
          and c.instructor_id = auth.uid()
      )
    )
  );

drop function if exists public.mint_offline_id_cards(int, text, uuid);

create or replace function public.mint_offline_id_cards(
  p_count int,
  p_batch_label text default null
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int := 0;
  v_remaining int;
  v_code text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'forbidden';
  end if;

  if p_count is null or p_count < 1 or p_count > 5000 then
    raise exception 'invalid count';
  end if;

  v_remaining := p_count;
  while v_remaining > 0 loop
    v_code := 'ID-' || public._offline_random_segment(3) || '-' || public._offline_random_segment(3);
    begin
      insert into public.offline_learner_id_cards (public_code, batch_label)
      values (v_code, p_batch_label);
      v_inserted := v_inserted + 1;
      v_remaining := v_remaining - 1;
    exception
      when unique_violation then
        null;
    end;
  end loop;

  return v_inserted;
end;
$$;

revoke all on function public.mint_offline_id_cards(int, text) from public;
grant execute on function public.mint_offline_id_cards(int, text) to authenticated;
