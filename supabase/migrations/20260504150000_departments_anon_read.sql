-- Public catalog (e.g. logged-out visitors browsing /courses) embeds
-- department:department_id in the courses select. Earlier migration
-- 20260416120000_departments_and_course_department.sql revoked all from public
-- and only granted SELECT to authenticated, so anon requests fail with
-- "permission denied for table departments".
--
-- Allow anon to read department lookup rows (id/name/sort_order are public taxonomy).

grant select on public.departments to anon;

drop policy if exists "Anon read departments" on public.departments;
create policy "Anon read departments"
  on public.departments
  for select
  to anon
  using (true);
