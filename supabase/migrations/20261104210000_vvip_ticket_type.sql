-- VVIP tickets: issued only by admins from the dashboard's Issue Ticket page.
--
-- * attendee_type may now be 'vvip'.
-- * The public booking policy refuses 'vvip' (as it already refuses
--   'organization'), so the anon key can't create one. Admins insert through
--   tickets_admin_all; staff have no insert policy at all.
-- * VVIP has no seat / per-booking limits: event_type_limits() returns nulls
--   for it, so tickets_enforce_type_limits() leaves it alone, and
--   event_ticket_availability() only reports the three public types.

alter table public.tickets drop constraint if exists tickets_attendee_type_check;
alter table public.tickets add constraint tickets_attendee_type_check
  check (attendee_type is null or attendee_type in ('student', 'regular', 'organization', 'vvip'));

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
    and attendee_type is distinct from 'vvip'
    and booking_request_id is null
  );
