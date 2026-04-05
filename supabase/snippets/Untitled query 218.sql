-- ID card scan attendance: card coordinators manage rosters; staff read all modules for tooling.

create policy "Card coordinators manage session roster"
  on public.module_session_roster
  for all
  to authenticated
  using (public.is_card_coordinator())
  with check (public.is_card_coordinator());

create policy "Admins and card coordinators view all modules"
  on public.modules
  for select
  to authenticated
  using (public.is_admin() or public.is_card_coordinator());
