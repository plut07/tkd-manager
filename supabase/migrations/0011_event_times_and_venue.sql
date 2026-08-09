-- 0011_event_times_and_venue.sql
--
-- 1. Events now carry a time of day as well as a date, so a registration
--    deadline can be "8 Aug 17:00" rather than a whole day. Existing DATE
--    values become midnight Singapore time, except the deadline which becomes
--    end-of-day so nobody's entry window silently shrinks.
-- 2. Organizer is chosen from the clubs list instead of typed free-hand.
-- 3. Venue gains a full address for the map preview.
-- 4. Discipline and City are retired — the venue address covers the city, and
--    discipline was never used for anything.

alter table public.events
  alter column start_date type timestamptz
    using (start_date::timestamp at time zone 'Asia/Singapore'),
  alter column end_date type timestamptz
    using (end_date::timestamp at time zone 'Asia/Singapore'),
  alter column registration_deadline type timestamptz
    using ((registration_deadline::timestamp + interval '23 hours 59 minutes') at time zone 'Asia/Singapore');

-- Organizer: keep the old text so nothing is lost, add the club reference.
alter table public.events
  add column if not exists organizer_club_id uuid references public.clubs (id) on delete set null;

-- Best-effort match of the existing free-text organizer to a club name.
update public.events e
set organizer_club_id = c.id
from public.clubs c
where e.organizer_club_id is null
  and e.organizer is not null
  and lower(trim(e.organizer)) = lower(trim(c.name));

alter table public.events
  add column if not exists venue_address text,
  add column if not exists venue_map_url text;

-- Seed the new address from whatever venue/city text already exists.
update public.events
set venue_address = nullif(trim(both ', ' from concat_ws(', ', venue, city, country)), '')
where venue_address is null;

-- Retired columns. Dropped rather than left behind so the form and the table
-- can't drift apart.
alter table public.events
  drop column if exists discipline,
  drop column if exists city;

create index if not exists events_organizer_club_idx on public.events (organizer_club_id);
