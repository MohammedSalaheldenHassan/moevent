-- Production hardening: the public (anon) key becomes read-only.
--
-- Before: anon could insert tickets and booking_requests directly through
-- Supabase's REST API, bypassing any rate limit — a script could book every
-- seat, or use our mailbox to flood someone with ticket emails.
-- After: bookings go only through POST /api/public/bookings, which validates
-- input, rate-limits per IP, caps bookings per email / phone per day and can
-- require a Cloudflare Turnstile check, then inserts with the service role.
-- anon keeps: read events, read seat counts (event_ticket_availability), read
-- public images and system_settings.

drop policy if exists "tickets_public_book" on public.tickets;
drop policy if exists "booking_requests_public_insert" on public.booking_requests;

-- Image buckets: images only, 5 MB max (uploads are admin-only already).
update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id in ('event-images', 'org-logos');
