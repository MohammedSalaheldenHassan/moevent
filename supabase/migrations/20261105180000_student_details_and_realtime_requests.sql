-- 1. Student tickets carry the holder's university and major.
--    Nullable: only student tickets have them, and older tickets don't. The
--    public booking API requires both for student tickets. Whole-row checks in
--    the staff trigger already stop staff from changing them.
alter table public.tickets
  add column if not exists customer_university text,
  add column if not exists customer_major text;

alter table public.tickets drop constraint if exists tickets_customer_university_check;
alter table public.tickets add constraint tickets_customer_university_check
  check (customer_university is null or char_length(customer_university) <= 120);

alter table public.tickets drop constraint if exists tickets_customer_major_check;
alter table public.tickets add constraint tickets_customer_major_check
  check (customer_major is null or char_length(customer_major) <= 120);

-- 2. Live organization requests in the dashboard.
--    Realtime applies booking_requests' RLS per subscriber, so only admins
--    (booking_requests_admin_all) receive these changes.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'booking_requests'
  ) then
    alter publication supabase_realtime add table public.booking_requests;
  end if;
end $$;
