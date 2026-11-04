-- Organization bookings need an admin's approval before any ticket exists.
--
-- The public site stores an organization booking as a row in booking_requests
-- (with the company's website). Nothing is added to tickets until an admin
-- calls approve_booking_request(), which creates the tickets and marks the
-- request approved in one transaction. Student / regular bookings still go
-- straight to tickets as before.

-- ── 1. Table ────────────────────────────────────────────────────────────────

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  -- Cascade: the cleanup job deletes expired events; their requests go too.
  event_id uuid not null references public.events(id) on delete cascade,
  customer_name text not null check (char_length(customer_name) between 1 and 80),
  customer_phone text not null check (char_length(customer_phone) between 9 and 20),
  customer_email text not null
    check (char_length(customer_email) <= 254 and customer_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  company_url text not null
    check (char_length(company_url) <= 2048 and company_url ~* '^https?://[^\s/]+\.[^\s]+$'),
  -- Same limit as the site's maxTicketsPerBooking.
  quantity integer not null check (quantity between 1 and 6),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null
);

create index if not exists booking_requests_event_status_idx
  on public.booking_requests (event_id, status, created_at desc);

-- Tickets created from a request point back to it.
alter table public.tickets
  add column if not exists booking_request_id uuid references public.booking_requests(id) on delete set null;

-- ── 2. RLS ──────────────────────────────────────────────────────────────────

alter table public.booking_requests enable row level security;

-- Public site: submit a pending request. No read access (emails, phones and
-- company links are never exposed to anon), and it can't pre-approve itself.
drop policy if exists "booking_requests_public_insert" on public.booking_requests;
create policy "booking_requests_public_insert" on public.booking_requests
  for insert to anon
  with check (status = 'pending' and decided_at is null and decided_by is null);

-- Close the bypass: anon must not insert organization tickets directly or
-- link a ticket to a request. Same conditions as before, plus those two.
drop policy if exists "tickets_public_book" on public.tickets;
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
    and attendee_type is distinct from 'organization'
    and booking_request_id is null
  );

drop policy if exists "booking_requests_admin_all" on public.booking_requests;
create policy "booking_requests_admin_all" on public.booking_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── 3. Approve / reject (admins only) ───────────────────────────────────────

create or replace function public.approve_booking_request(p_request_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.booking_requests;
  created integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can approve booking requests' using errcode = '42501';
  end if;

  -- Row lock: two admins clicking Approve at once can't create tickets twice.
  select * into r from public.booking_requests where id = p_request_id for update;
  if not found then
    raise exception 'Booking request not found' using errcode = 'P0002';
  end if;
  if r.status <> 'pending' then
    raise exception 'This request was already %', r.status using errcode = '22023';
  end if;

  insert into public.tickets
    (event_id, customer_name, customer_phone, customer_email, attendee_type, booking_request_id)
  select r.event_id, r.customer_name, r.customer_phone, r.customer_email, 'organization', r.id
  from generate_series(1, r.quantity);
  get diagnostics created = row_count;

  update public.booking_requests
  set status = 'approved', decided_at = now(), decided_by = auth.uid()
  where id = r.id;

  return created;
end;
$$;

create or replace function public.reject_booking_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can reject booking requests' using errcode = '42501';
  end if;

  update public.booking_requests
  set status = 'rejected', decided_at = now(), decided_by = auth.uid()
  where id = p_request_id and status = 'pending';

  if not found then
    raise exception 'Booking request not found or already decided' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.approve_booking_request(uuid) from public, anon;
revoke all on function public.reject_booking_request(uuid) from public, anon;
grant execute on function public.approve_booking_request(uuid) to authenticated;
grant execute on function public.reject_booking_request(uuid) to authenticated;
