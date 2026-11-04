-- Map position of the venue, picked on a map in the dashboard's event form.
-- `location` stays the human-readable venue text; these pin it on a map.
-- Both null (no pin) or both set.

alter table public.events
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.events drop constraint if exists events_coordinates_check;
alter table public.events add constraint events_coordinates_check check (
  (latitude is null and longitude is null)
  or (latitude between -90 and 90 and longitude between -180 and 180)
);
