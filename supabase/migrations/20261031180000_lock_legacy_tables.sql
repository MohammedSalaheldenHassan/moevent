-- Lock down the two remaining tables whose policies let any signed-in account
-- write. Public sign-up is enabled in Supabase Auth, so "any signed-in account"
-- includes strangers. Only admins may write; system_settings stays publicly
-- readable (it holds the legacy system name and logo).

drop policy if exists "Auth users can manage logs" on public.activity_logs;
create policy "activity_logs_admin_all" on public.activity_logs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Authenticated write system_settings" on public.system_settings;
create policy "system_settings_admin_write" on public.system_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
