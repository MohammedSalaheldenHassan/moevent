-- Convert MoEvent from multi-tenant SaaS to a single business.
--
-- Data: every event and profile is moved to one organization row (the one that
-- held the most events), which is renamed "MoEvent". No events, tickets,
-- event_access rows or users are deleted. The other organization rows are
-- removed only after nothing references them.
--
-- Roles: only 'admin' and 'staff' remain. mohammedsalah@gmail.com is the sole
-- admin; all other admins and the super_admin become staff.
--
-- RLS: the old policy set mixed `true` policies with org-scoped ones, so it
-- isolated nothing and let anyone with the anon key read all tickets and edit
-- any profile. It is replaced with role-based policies:
--   admin  -> full access (dashboard)
--   staff  -> exactly what the gate app (e_s_s) uses:
--             own profile row, own event_access rows, assigned events,
--             read + claim tickets of assigned events.
--   anon   -> public booking site: read events, insert unscanned tickets.
--             No read access to tickets or profiles.

-- ── 1. Single organization ───────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from public.organizations where id = '7bdb50a1-977d-4ca1-bfe0-41f7f01db389') then
    raise exception 'Organization to keep (7bdb50a1-…) not found; aborting';
  end if;
end $$;

update public.organizations
set name = 'MoEvent',
    -- Current value is not a URL ('kjhjkh'); reuse the uploaded logo of "MO EVENTS SYSTEM".
    logo_url = (select logo_url from public.organizations where id = '5df0513a-4244-4106-aea6-44fd37d20e23'),
    -- Dashboard accent; #7c3aed is the app default and what every other org used.
    primary_color = '#7c3aed'
where id = '7bdb50a1-977d-4ca1-bfe0-41f7f01db389';

update public.events
set org_id = '7bdb50a1-977d-4ca1-bfe0-41f7f01db389'
where org_id is distinct from '7bdb50a1-977d-4ca1-bfe0-41f7f01db389';

update public.profiles
set org_id = '7bdb50a1-977d-4ca1-bfe0-41f7f01db389'
where org_id is distinct from '7bdb50a1-977d-4ca1-bfe0-41f7f01db389';

-- New rows land in the single org without the app having to send org_id.
alter table public.events   alter column org_id set default '7bdb50a1-977d-4ca1-bfe0-41f7f01db389';
alter table public.events   alter column org_id set not null;
alter table public.profiles alter column org_id set default '7bdb50a1-977d-4ca1-bfe0-41f7f01db389';
alter table public.profiles alter column org_id set not null;

delete from public.organizations where id <> '7bdb50a1-977d-4ca1-bfe0-41f7f01db389';

-- ── 2. Roles ─────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from public.profiles where email = 'mohammedsalah@gmail.com') then
    raise exception 'Admin to keep (mohammedsalah@gmail.com) not found; aborting';
  end if;
end $$;

-- mohammedsalah@gmail.com is the only admin; every other admin / super_admin
-- becomes staff (no accounts are deleted).
update public.profiles set role = 'admin' where email = 'mohammedsalah@gmail.com';
update public.profiles set role = 'staff'
where role in ('admin', 'super_admin') and email is distinct from 'mohammedsalah@gmail.com';

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'staff'));
alter table public.profiles alter column role set default 'staff';
alter table public.profiles alter column role set not null;

-- ── 3. RLS helpers ───────────────────────────────────────────────────────────
-- SECURITY DEFINER so policies on profiles can check the caller's role without
-- recursing into profiles' own RLS. get_my_role() already exists; redefined
-- here with a pinned search_path.

create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.my_event_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select event_id from public.event_access where profile_id = auth.uid();
$$;

-- ── 4. Drop the old policies ─────────────────────────────────────────────────

drop policy if exists "Admin full access to event_access"              on public.event_access;
drop policy if exists "Allow admin to manage event access"             on public.event_access;
drop policy if exists "Allow full access for authenticated users"      on public.event_access;
drop policy if exists "Allow insert for authenticated users"           on public.event_access;

drop policy if exists "Admin full access events"                       on public.events;
drop policy if exists "Enable delete for users based on user_id"       on public.events;
drop policy if exists "Enable read access for all users"               on public.events;
drop policy if exists "Master admin access"                            on public.events;
drop policy if exists "Public can view events"                         on public.events;
drop policy if exists "Users can only see their own organization's events" on public.events;

drop policy if exists "organizations_delete"                           on public.organizations;
drop policy if exists "organizations_insert"                           on public.organizations;
drop policy if exists "organizations_select"                           on public.organizations;
drop policy if exists "organizations_update"                           on public.organizations;

drop policy if exists "Admin can manage profiles"                      on public.profiles;
drop policy if exists "Admin full access profiles"                     on public.profiles;
drop policy if exists "Admins can manage profiles s"                   on public.profiles;
drop policy if exists "Admins can read all profiles"                   on public.profiles;
drop policy if exists "Full access to profiles"                        on public.profiles;

drop policy if exists "Admin full access tickets"                      on public.tickets;
drop policy if exists "Allow public to insert tickets"                 on public.tickets;
drop policy if exists "Allow public to select tickets"                 on public.tickets;
drop policy if exists "Enable insert for authenticated users only"     on public.tickets;
drop policy if exists "Enable read access for all users"               on public.tickets;
drop policy if exists "Public can book tickets"                        on public.tickets;
drop policy if exists "Public can view tickets"                        on public.tickets;
drop policy if exists "Users can only see their own organization's tickets" on public.tickets;

drop policy if exists "Allow anyone to upload to event-images"         on storage.objects;
drop policy if exists "Authenticated users can update"                 on storage.objects;
drop policy if exists "Authenticated users can upload"                 on storage.objects;

-- ── 5. New policies ──────────────────────────────────────────────────────────

-- organizations: everyone signed in reads branding; writes go through the API (service role).
create policy "org_read" on public.organizations
  for select to authenticated using (true);
create policy "org_admin_write" on public.organizations
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- profiles: own row for everyone, all rows for admins. Staff cannot change their role.
create policy "profiles_read_own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles_admin_all" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- event_access: staff see their own assignments; admins manage all.
create policy "event_access_read_own" on public.event_access
  for select to authenticated using (profile_id = auth.uid());
create policy "event_access_admin_all" on public.event_access
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- events: staff read assigned events; admins manage all.
create policy "events_read_assigned" on public.events
  for select to authenticated using (id in (select public.my_event_ids()));
create policy "events_admin_all" on public.events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- tickets: staff read and claim (scan) tickets of assigned events; admins manage all.
create policy "tickets_read_assigned" on public.tickets
  for select to authenticated using (event_id in (select public.my_event_ids()));
create policy "tickets_scan_assigned" on public.tickets
  for update to authenticated
  using (event_id in (select public.my_event_ids()))
  with check (event_id in (select public.my_event_ids()));
create policy "tickets_admin_all" on public.tickets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Public booking site (anon key): list events and book tickets. It cannot read
-- tickets back, so customer names and phones are never exposed to anon, and a
-- new ticket cannot arrive already scanned or emailed.
create policy "events_public_read" on public.events
  for select to anon using (true);
-- Payment fields are never client-controlled: a booking always starts 'pending'
-- and only the server (service role) may mark it paid.
create policy "tickets_public_book" on public.tickets
  for insert to anon
  with check (
    event_id is not null
    and coalesce(is_scanned, false) = false
    and scanned_at is null
    and scanned_by is null
    and is_emailed = false
    and payment_status = 'pending'
    and transaction_id is null
    and commission_amount is null
  );

-- ── 6. Staff may only scan ───────────────────────────────────────────────────
-- RLS cannot limit columns, and admin and staff share the `authenticated`
-- Postgres role, so column grants cannot either. This trigger lets a non-admin
-- signed-in user change only is_scanned / scanned_at / scanned_by, only to
-- claim an unscanned ticket, and only in their own name. Admins, the service
-- role (API) and direct DB connections are not affected.

create or replace function public.tickets_staff_scan_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'authenticated' or public.is_admin() then
    return new;
  end if;

  if (to_jsonb(new) - array['is_scanned', 'scanned_at', 'scanned_by'])
     is distinct from (to_jsonb(old) - array['is_scanned', 'scanned_at', 'scanned_by']) then
    raise exception 'Staff may only change scan fields on tickets' using errcode = '42501';
  end if;

  if coalesce(old.is_scanned, false) or new.is_scanned is distinct from true
     or new.scanned_by is distinct from auth.uid() then
    raise exception 'Staff may only mark an unscanned ticket as scanned by themselves' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger tickets_staff_scan_only
  before update on public.tickets
  for each row execute function public.tickets_staff_scan_only();

-- ── 7. Storage ──────────────────────────────────────────────────────────────
-- storage: event images stay publicly readable (existing read policies kept);
-- only admins upload or replace them.
create policy "event_images_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-images' and public.is_admin());
create policy "event_images_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'event-images' and public.is_admin());
