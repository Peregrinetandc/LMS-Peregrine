-- Learning streak rollup: one row per learner, maintained by trigger on module_progress.
--
-- Edge cases (see private.maintain_learning_streak):
-- * Same UTC day, multiple completions: streak counters unchanged (last_success_day already equals that day).
-- * Module un-completed: streak not decremented in DB; display view zeros streak when idle too long.
-- * Backdated completion (UTC date < last_success_day): ignored — streak never rewinds.

create schema if not exists private;

revoke all on schema private from public;

-- ── Table ───────────────────────────────────────────────────────────────────
create table public.learning_streak (
  learner_id        uuid primary key references public.profiles(id) on delete cascade,
  current_streak    integer not null default 0,
  longest_streak    integer not null default 0,
  last_success_day  date,
  updated_at        timestamptz not null default now()
);

alter table public.learning_streak enable row level security;

create policy "learner reads own streak"
  on public.learning_streak for select
  to authenticated
  using (auth.uid() = learner_id);

revoke all on public.learning_streak from public;
grant select on public.learning_streak to authenticated;

-- ── Trigger function ─────────────────────────────────────────────────────────
create or replace function private.maintain_learning_streak()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
  v_row public.learning_streak%rowtype;
  v_new_streak integer;
begin
  if new.is_completed is distinct from true or new.completed_at is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.is_completed is true
    and old.completed_at is not null then
    return new;
  end if;

  v_day := (timezone('UTC', new.completed_at))::date;

  select * into v_row
  from public.learning_streak
  where learner_id = new.learner_id;

  if not found then
    insert into public.learning_streak (learner_id, current_streak, longest_streak, last_success_day, updated_at)
    values (new.learner_id, 1, 1, v_day, now());
    return new;
  end if;

  if v_row.last_success_day = v_day then
    return new;
  end if;

  if v_day < v_row.last_success_day then
    return new;
  end if;

  if v_row.last_success_day = v_day - 1 then
    v_new_streak := v_row.current_streak + 1;
  else
    v_new_streak := 1;
  end if;

  update public.learning_streak
  set
    current_streak = v_new_streak,
    longest_streak = greatest(v_row.longest_streak, v_new_streak),
    last_success_day = v_day,
    updated_at = now()
  where learner_id = new.learner_id;

  return new;
end;
$$;

drop trigger if exists trg_learning_streak on public.module_progress;
create trigger trg_learning_streak
  after insert or update of is_completed, completed_at
  on public.module_progress
  for each row
  execute function private.maintain_learning_streak();

-- ── Display view (grace: streak 0 if last success older than yesterday UTC) ─
create or replace view public.learning_streak_display
with (security_invoker = true)
as
select
  learner_id,
  last_success_day,
  longest_streak,
  case
    when last_success_day is not null
      and last_success_day >= ((timezone('UTC', now()))::date - 1)
    then current_streak
    else 0
  end as streak
from public.learning_streak;

grant select on public.learning_streak_display to authenticated;

-- ── One-time backfill from module_progress (distinct UTC days per learner) ─
do $$
declare
  r record;
  v_days date[];
  n int;
  v_longest int;
  v_run int;
  i int;
  v_curr int;
  j int;
begin
  for r in
    select distinct learner_id
    from public.module_progress
    where is_completed = true
      and completed_at is not null
  loop
    select array_agg(d order by d) into v_days
    from (
      select distinct (timezone('UTC', completed_at))::date as d
      from public.module_progress
      where learner_id = r.learner_id
        and is_completed = true
        and completed_at is not null
    ) s;

    if v_days is null or coalesce(array_length(v_days, 1), 0) = 0 then
      continue;
    end if;

    n := array_length(v_days, 1);

    v_longest := 1;
    v_run := 1;
    for i in 2..n loop
      if v_days[i] = v_days[i - 1] + 1 then
        v_run := v_run + 1;
      else
        if v_run > v_longest then
          v_longest := v_run;
        end if;
        v_run := 1;
      end if;
    end loop;
    if v_run > v_longest then
      v_longest := v_run;
    end if;

    v_curr := 1;
    for j in reverse n..2 loop
      if v_days[j] = v_days[j - 1] + 1 then
        v_curr := v_curr + 1;
      else
        exit;
      end if;
    end loop;

    insert into public.learning_streak (learner_id, current_streak, longest_streak, last_success_day, updated_at)
    values (r.learner_id, v_curr, v_longest, v_days[n], now())
    on conflict (learner_id) do update set
      current_streak = excluded.current_streak,
      longest_streak = excluded.longest_streak,
      last_success_day = excluded.last_success_day,
      updated_at = excluded.updated_at;
  end loop;
end;
$$;
