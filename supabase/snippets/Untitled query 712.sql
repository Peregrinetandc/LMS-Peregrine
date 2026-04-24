-- Normalize modules: move type-specific attributes to subtype tables.
-- Planned for a maintenance-window cutover.

begin;

-- 1) New subtype tables
create table if not exists public.module_content (
  module_id uuid primary key references public.modules(id) on delete cascade,
  content_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.module_session (
  module_id uuid primary key references public.modules(id) on delete cascade,
  session_location text,
  session_start_at timestamptz,
  session_end_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint module_session_time_check
    check (session_end_at is null or session_start_at is null or session_end_at >= session_start_at)
);

create table if not exists public.module_quiz_settings (
  module_id uuid primary key references public.modules(id) on delete cascade,
  quiz_passing_pct smallint not null default 60
    check (quiz_passing_pct >= 0 and quiz_passing_pct <= 100),
  quiz_allow_retest boolean not null default true,
  quiz_time_limit_minutes smallint
    check (quiz_time_limit_minutes is null or (quiz_time_limit_minutes >= 1 and quiz_time_limit_minutes <= 1440)),
  quiz_randomize_questions boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.module_content enable row level security;
alter table public.module_session enable row level security;
alter table public.module_quiz_settings enable row level security;

create policy "View module content with modules"
  on public.module_content for select to authenticated
  using (
    exists (
      select 1 from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = module_content.module_id
        and (c.status = 'published' or c.instructor_id = auth.uid() or public.is_admin())
    )
  );

create policy "Staff manage module content"
  on public.module_content for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = module_content.module_id and c.instructor_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = module_content.module_id and c.instructor_id = auth.uid()
    )
  );

create policy "View module sessions with modules"
  on public.module_session for select to authenticated
  using (
    exists (
      select 1 from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = module_session.module_id
        and (c.status = 'published' or c.instructor_id = auth.uid() or public.is_admin())
    )
  );

create policy "Staff manage module sessions"
  on public.module_session for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = module_session.module_id and c.instructor_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = module_session.module_id and c.instructor_id = auth.uid()
    )
  );

create policy "View module quiz settings with modules"
  on public.module_quiz_settings for select to authenticated
  using (
    exists (
      select 1 from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = module_quiz_settings.module_id
        and (c.status = 'published' or c.instructor_id = auth.uid() or public.is_admin())
    )
  );

create policy "Staff manage module quiz settings"
  on public.module_quiz_settings for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = module_quiz_settings.module_id and c.instructor_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = module_quiz_settings.module_id and c.instructor_id = auth.uid()
    )
  );

-- 2) Core indexes for ordering and RLS traversal
create index if not exists modules_course_sort_idx
  on public.modules (course_id, sort_order, id);

create index if not exists modules_course_week_sort_idx
  on public.modules (course_id, week_index, sort_order, id);

create index if not exists modules_course_type_idx
  on public.modules (course_id, type, sort_order, id);

-- 3) Backfill subtype data from existing kitchen-sink columns
insert into public.module_content (module_id, content_url)
select
  m.id,
  m.content_url
from public.modules m
where m.type in ('video', 'document', 'live_session')
on conflict (module_id) do update
set content_url = excluded.content_url;

insert into public.module_session (
  module_id,
  session_location,
  session_start_at,
  session_end_at
)
select
  m.id,
  m.session_location,
  m.session_start_at,
  m.session_end_at
from public.modules m
where m.type in ('live_session', 'offline_session')
on conflict (module_id) do update
set
  session_location = excluded.session_location,
  session_start_at = excluded.session_start_at,
  session_end_at = excluded.session_end_at;

insert into public.module_quiz_settings (
  module_id,
  quiz_passing_pct,
  quiz_allow_retest,
  quiz_time_limit_minutes,
  quiz_randomize_questions
)
select
  m.id,
  m.quiz_passing_pct,
  m.quiz_allow_retest,
  m.quiz_time_limit_minutes,
  m.quiz_randomize_questions
from public.modules m
where m.type in ('quiz', 'mcq')
on conflict (module_id) do update
set
  quiz_passing_pct = excluded.quiz_passing_pct,
  quiz_allow_retest = excluded.quiz_allow_retest,
  quiz_time_limit_minutes = excluded.quiz_time_limit_minutes,
  quiz_randomize_questions = excluded.quiz_randomize_questions;

-- 4) Light integrity guards for subtype alignment
create or replace function public.enforce_module_subtype_integrity()
returns trigger
language plpgsql
as $$
begin
  if new.type in ('video', 'document', 'live_session') then
    if not exists (select 1 from public.module_content mc where mc.module_id = new.id) then
      raise exception 'module_content row missing for module % of type %', new.id, new.type;
    end if;
  end if;

  if new.type in ('live_session', 'offline_session') then
    if not exists (select 1 from public.module_session ms where ms.module_id = new.id) then
      raise exception 'module_session row missing for module % of type %', new.id, new.type;
    end if;
  end if;

  if new.type in ('quiz', 'mcq') then
    if not exists (select 1 from public.module_quiz_settings qs where qs.module_id = new.id) then
      raise exception 'module_quiz_settings row missing for module % of type %', new.id, new.type;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_module_subtype_integrity on public.modules;
create constraint trigger trg_enforce_module_subtype_integrity
after insert or update of type
on public.modules
deferrable initially deferred
for each row
execute function public.enforce_module_subtype_integrity();

-- 5) Drop moved columns from modules once backfill and app cutover are in place
alter table public.modules
  drop column if exists content_url,
  drop column if exists session_location,
  drop column if exists session_start_at,
  drop column if exists session_end_at,
  drop column if exists quiz_passing_pct,
  drop column if exists quiz_allow_retest,
  drop column if exists quiz_time_limit_minutes,
  drop column if exists quiz_randomize_questions;

commit;
