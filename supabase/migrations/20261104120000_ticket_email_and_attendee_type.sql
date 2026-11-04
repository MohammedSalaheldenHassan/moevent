-- Booking details collected by the public site: the attendee's email and
-- which kind of ticket they are booking (student / regular / organization).
--
-- Both columns are nullable: existing tickets and tickets issued from the
-- dashboard don't have them. The public site always sends both.
--
-- RLS: the existing "tickets_public_book" insert policy already lets anon set
-- these columns (it only pins the scan / payment fields), and anon still
-- cannot read tickets back, so emails are never exposed publicly. The staff
-- scan-only trigger compares whole rows, so staff cannot change them either.

alter table public.tickets add column if not exists customer_email text;
alter table public.tickets add column if not exists attendee_type text;

alter table public.tickets drop constraint if exists tickets_customer_email_check;
alter table public.tickets add constraint tickets_customer_email_check
  check (customer_email is null or (char_length(customer_email) <= 254 and customer_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));

alter table public.tickets drop constraint if exists tickets_attendee_type_check;
alter table public.tickets add constraint tickets_attendee_type_check
  check (attendee_type is null or attendee_type in ('student', 'regular', 'organization'));
