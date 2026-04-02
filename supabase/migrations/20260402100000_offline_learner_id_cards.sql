-- Physical offline ID cards: unique public codes, bind to learner + course (staff).

-- Random segment for generator (internal).
create or replace function public._offline_random_segment(p_len int)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  res text := '';
  i int;
begin
  if p_len is null or p_len < 1 or p_len > 32 then
    raise exception 'invalid segment length';
  end if;
  for i in 1..p_len loop
    res := res || substr(alphabet, 1 + floor(random() * 36)::int, 1);
  end loop;
  return res;
end;
$$;

revoke all on function public._offline_random_segment(int) from public;

create table public.offline_learner_id_cards (
  id uuid primary key default gen_random_uuid(),
  public_code text not null,
  course_id uuid references public.courses(id) on delete set null,
  learner_id uuid references public.profiles(id) on delete set null,
  bound_at timestamptz,
  bound_by uuid references public.profiles(id) on delete set null,
  batch_id uuid,
  batch_label text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offline_learner_id_cards_public_code_format_chk
    check (public_code ~ '^ID-[A-Z0-9]{3}-[A-Z0-9]{3}$'),
  constraint offline_learner_id_cards_bound_consistency_chk
    check (
      (learner_id is null and bound_at is null and bound_by is null)
      or (learner_id is not null and bound_at is not null and bound_by is not null)
    )
);

create unique index offline_learner_id_cards_public_code_key on public.offline_learner_id_cards (public_code);

-- One bound card per learner per course (business rule for MVP).
create unique index offline_learner_id_cards_learner_course_active_key
  on public.offline_learner_id_cards (learner_id, course_id)
  where learner_id is not null;

create or replace function public.touch_offline_learner_id_cards_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger offline_learner_id_cards_touch_updated_at
  before update on public.offline_learner_id_cards
  for each row
  execute function public.touch_offline_learner_id_cards_updated_at();

alter table public.offline_learner_id_cards enable row level security;

create policy "Learners read own offline id card"
  on public.offline_learner_id_cards
  for select
  to authenticated
  using (learner_id = auth.uid());

create policy "Staff read offline id cards"
  on public.offline_learner_id_cards
  for select
  to authenticated
  using (
    public.is_admin()
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

create policy "Admin manage offline id cards"
  on public.offline_learner_id_cards
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Instructors update offline id cards for their courses"
  on public.offline_learner_id_cards
  for update
  to authenticated
  using (
    not public.is_admin()
    and (
      course_id is null
      or exists (
        select 1
        from public.courses c
        where c.id = offline_learner_id_cards.course_id
          and c.instructor_id = auth.uid()
      )
    )
  )
  with check (
    not public.is_admin()
    and (
      course_id is null
      or exists (
        select 1
        from public.courses c
        where c.id = offline_learner_id_cards.course_id
          and c.instructor_id = auth.uid()
      )
    )
  );

-- Mint unredeemed rows (admin-only; uses auth.uid() inside definer).
create or replace function public.mint_offline_id_cards(
  p_count int,
  p_batch_label text default null,
  p_course_id uuid default null
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
      insert into public.offline_learner_id_cards (public_code, batch_label, course_id)
      values (v_code, p_batch_label, p_course_id);
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

revoke all on function public.mint_offline_id_cards(int, text, uuid) from public;
grant execute on function public.mint_offline_id_cards(int, text, uuid) to authenticated;
