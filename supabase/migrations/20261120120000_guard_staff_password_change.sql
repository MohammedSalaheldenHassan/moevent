-- Staff passwords may only change through a verified path.
--
-- The gate app's first password is shared, so a staff password change must be
-- proven with an email code. Supabase's own reauthentication nonce is ignored
-- for sessions younger than 24h, so the check lives here instead:
--
--   * A password change on a staff account is rejected unless the account's
--     app_metadata has password_change_ok = true. Only the service role can
--     write app_metadata, so only the API (after verifying the email code, or
--     an admin reset) can set it.
--   * Any password change that goes through removes password_change_ok (one
--     use) and must_change_password (the first-login flag), in the same row.
--
-- Admin accounts are not restricted. To set a staff password from server code:
--   1. admin.updateUserById(id, { app_metadata: { password_change_ok: true } })
--   2. admin.updateUserById(id, { password })
--   3. if 2 fails, remove the marker again.

create or replace function public.guard_staff_password_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.encrypted_password is not distinct from old.encrypted_password then
    return new;
  end if;

  if coalesce(old.raw_app_meta_data ->> 'password_change_ok', '') <> 'true'
     and exists (
       select 1 from public.profiles p
       where p.id = new.id and p.role = 'staff'
     )
  then
    raise exception 'Staff password changes require email verification'
      using errcode = '42501';
  end if;

  new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
                           - 'password_change_ok'
                           - 'must_change_password';
  return new;
end;
$$;

revoke all on function public.guard_staff_password_change()
  from public, anon, authenticated;

drop trigger if exists guard_staff_password_change on auth.users;
create trigger guard_staff_password_change
  before update of encrypted_password on auth.users
  for each row
  execute function public.guard_staff_password_change();
