-- One-off, run by hand in the SQL editor (not a migration).
-- Run AFTER migration 20261120120000_guard_staff_password_change.sql.
--
-- Flags every active staff account to set its own password at the next
-- gate-app sign-in. Admins are not flagged (role = 'staff' only). The Google
-- Play reviewer account is excluded: it cannot receive the email code.
-- Replace [reviewer email] in BOTH statements before running.

-- 1. Preview: the accounts that will be flagged.
select u.id, u.email, u.last_sign_in_at,
       u.raw_app_meta_data ->> 'must_change_password' as already_flagged
from auth.users u
join public.profiles p on p.id = u.id
where u.deleted_at is null
  and p.role = 'staff'
  and u.email <> '[reviewer email]'
order by u.email;

-- 2. Flag them. The row count should match the preview.
update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
                        || '{"must_change_password": true}'::jsonb
from public.profiles p
where p.id = u.id
  and u.deleted_at is null
  and p.role = 'staff'
  and u.email <> '[reviewer email]';
