-- Course builder: admins can update courses ("Admins update any course") but modules/sections/assignments
-- were instructor-only. Admins editing another instructor's course hit RLS on module insert/update.

create policy "Admins manage all sections"
  on public.sections
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage all modules"
  on public.modules
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage all assignments"
  on public.assignments
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
