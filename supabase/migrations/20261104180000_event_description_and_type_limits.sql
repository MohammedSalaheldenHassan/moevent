-- Event description, plus per-ticket-type limits set by the admin:
--   capacity_<type>         total seats for that type (null = unlimited, 0 = not offered)
--   max_per_booking_<type>  most tickets one booking may take (null = site default)
--
-- Limits are enforced in the database, not just the site:
--   * a statement-level trigger on tickets checks both limits for every insert
--     (public bookings and admin approvals alike; admins skip the per-booking
--     limit), serialised per event so two bookings can't oversell the last seats;
--   * a trigger on booking_requests rejects organization requests that exceed
--     the per-booking limit or the seats currently left.
-- Tickets without a type (issued from the dashboard's Issue Ticket page, or
-- created before types existed) don't count toward any type's seats.

-- ── 1. Columns ──────────────────────────────────────────────────────────────

alter table public.events
  add column if not exists description text,
  add column if not exists capacity_student integer,
  add column if not exists capacity_regular integer,
  add column if not exists capacity_organization integer,
  add column if not exists max_per_booking_student integer,
  add column if not exists max_per_booking_regular integer,
  add column if not exists max_per_booking_organization integer;

alter table public.events drop constraint if exists events_description_check;
alter table public.events add constraint events_description_check
  check (description is null or char_length(description) <= 5000);

alter table public.events drop constraint if exists events_type_limits_check;
alter table public.events add constraint events_type_limits_check check (
  coalesce(capacity_student, 0) >= 0
  and coalesce(capacity_regular, 0) >= 0
  and coalesce(capacity_organization, 0) >= 0
  and coalesce(max_per_booking_student, 1) between 1 and 1000
  and coalesce(max_per_booking_regular, 1) between 1 and 1000
  and coalesce(max_per_booking_organization, 1) between 1 and 1000
);

-- Organization requests may now be larger than the old fixed 6.
alter table public.booking_requests drop constraint if exists booking_requests_quantity_check;
alter table public.booking_requests add constraint booking_requests_quantity_check
  check (quantity between 1 and 1000);

-- ── 2. Helpers ──────────────────────────────────────────────────────────────

create or replace function public.event_type_limits(p_event_id uuid, p_type text, out capacity integer, out max_per_booking integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    case p_type when 'student' then capacity_student when 'regular' then capacity_regular when 'organization' then capacity_organization end,
    case p_type when 'student' then max_per_booking_student when 'regular' then max_per_booking_regular when 'organization' then max_per_booking_organization end
  from public.events where id = p_event_id;
$$;

-- Public, counts only (no personal data): seats per type for one event.
-- `sold` includes unconfirmed bookings — they hold their seats.
create or replace function public.event_ticket_availability(p_event_id uuid)
returns table (attendee_type text, capacity integer, sold integer, max_per_booking integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.type,
    l.capacity,
    (select count(*)::integer from public.tickets tk where tk.event_id = p_event_id and tk.attendee_type = t.type),
    l.max_per_booking
  from (values ('student'), ('regular'), ('organization')) as t(type)
  cross join lateral public.event_type_limits(p_event_id, t.type) as l
  where exists (select 1 from public.events where id = p_event_id);
$$;

revoke all on function public.event_type_limits(uuid, text) from public, anon, authenticated;
grant execute on function public.event_ticket_availability(uuid) to anon, authenticated;

-- ── 3. Enforcement on tickets ───────────────────────────────────────────────

create or replace function public.tickets_enforce_type_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
  lim record;
  taken integer;
begin
  for g in
    select n.event_id, n.attendee_type, count(*)::integer as added
    from new_rows n
    where n.attendee_type is not null and n.event_id is not null
    group by n.event_id, n.attendee_type
    order by n.event_id  -- consistent lock order
  loop
    -- One booking at a time per event: a concurrent insert waits here, then
    -- counts again with the other booking's rows visible.
    perform 1 from public.events where id = g.event_id for update;
    select * into lim from public.event_type_limits(g.event_id, g.attendee_type);

    if lim.max_per_booking is not null and g.added > lim.max_per_booking and not public.is_admin() then
      raise exception 'At most % % ticket(s) per booking', lim.max_per_booking, g.attendee_type
        using errcode = 'P0001', hint = 'max_per_booking';
    end if;

    if lim.capacity is not null then
      select count(*) into taken from public.tickets
      where event_id = g.event_id and attendee_type = g.attendee_type;
      if taken > lim.capacity then
        raise exception 'Not enough % seats left (% of % taken)', g.attendee_type, taken - g.added, lim.capacity
          using errcode = 'P0001', hint = 'sold_out';
      end if;
    end if;
  end loop;
  return null;
end;
$$;

drop trigger if exists tickets_enforce_type_limits on public.tickets;
create trigger tickets_enforce_type_limits
  after insert on public.tickets
  referencing new table as new_rows
  for each statement execute function public.tickets_enforce_type_limits();

-- ── 4. Enforcement on organization requests ─────────────────────────────────

create or replace function public.booking_requests_check_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lim record;
  taken integer;
begin
  select * into lim from public.event_type_limits(new.event_id, 'organization');

  if lim.max_per_booking is not null and new.quantity > lim.max_per_booking then
    raise exception 'At most % organization ticket(s) per booking', lim.max_per_booking
      using errcode = 'P0001', hint = 'max_per_booking';
  end if;

  -- Soft check at request time; approval re-checks under the event lock.
  if lim.capacity is not null then
    select count(*) into taken from public.tickets
    where event_id = new.event_id and attendee_type = 'organization';
    if new.quantity > lim.capacity - taken then
      raise exception 'Not enough organization seats left'
        using errcode = 'P0001', hint = 'sold_out';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists booking_requests_check_limits on public.booking_requests;
create trigger booking_requests_check_limits
  before insert on public.booking_requests
  for each row execute function public.booking_requests_check_limits();
