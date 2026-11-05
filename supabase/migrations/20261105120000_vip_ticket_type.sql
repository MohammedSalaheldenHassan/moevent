-- VIP tickets, alongside VVIP: both issued only by admins from the dashboard.
--
-- * attendee_type may now be 'vip'.
-- * Like VVIP, VIP has no seat / per-booking limits (event_type_limits()
--   returns nulls for any type other than the three public ones) and isn't
--   listed by event_ticket_availability().
-- * The public booking API only accepts student / regular / organization, and
--   anon has no insert policy on tickets, so VIP can't be booked publicly.

alter table public.tickets drop constraint if exists tickets_attendee_type_check;
alter table public.tickets add constraint tickets_attendee_type_check
  check (attendee_type is null or attendee_type in ('student', 'regular', 'organization', 'vip', 'vvip'));
