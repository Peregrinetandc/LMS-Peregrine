insert into public.enrollments (course_id, learner_id)
select
  '69d8506b-43e9-4332-aa5d-50d3c4bfa0f4'::uuid,
  p.id
from public.profiles p
where p.role = 'learner'
on conflict (course_id, learner_id) do nothing;

select id, title from public.courses order by title;

select count(*) from public.enrollments
where course_id = '69d8506b-43e9-4332-aa5d-50d3c4bfa0f4'::uuid;