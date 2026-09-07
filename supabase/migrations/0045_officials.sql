-- The people running the ring.
--
-- Until now a judge was a slot number. The pad said "Judge 3", the score sheet
-- said "Judge 3", and a bout questioned a week later could say who had scored
-- what but not who that was. At any event with an umpire panel worth the name
-- that is the one thing you need.
--
-- Officials are their own list rather than students, because most of them are
-- not on this system: an international umpire flies in, judges for two days and
-- goes home, and requiring a student record for them would mean inventing one.
-- Where an official *is* a member -- most of the domestic panel -- student_id
-- links them, so their name and country come from the one place.

create table if not exists public.event_officials (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,

  -- Always present, so an official needs nothing else to exist.
  full_name text not null,
  -- Set when they are on the system, which most of the domestic panel will be.
  student_id uuid references public.students(id) on delete set null,
  club_id uuid references public.clubs(id) on delete set null,
  country text,

  -- "International Class A", "National", "Regional" -- free text on purpose:
  -- the grades differ between countries and between the ITF's own eras, and
  -- pinning them to a list here would just mean a list that is wrong somewhere.
  qualification text,

  role text not null default 'judge'
    check (role in ('referee', 'judge', 'jury', 'timekeeper', 'recorder', 'coordinator')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists event_officials_event_idx on public.event_officials(event_id);
create index if not exists event_officials_student_idx on public.event_officials(student_id);
create index if not exists event_officials_club_idx on public.event_officials(club_id);

alter table public.event_officials enable row level security;
-- No policies: read and written by the server with the service key.

-- Who is sitting where.
--
-- Slot 0 is the referee, 1..9 are the corner judges -- the same numbering the
-- scoreboard already uses for its presses, so a mark and the person who made it
-- line up without a translation step.
create table if not exists public.ring_officials (
  ring_id uuid not null references public.scoreboard_rings(id) on delete cascade,
  official_id uuid not null references public.event_officials(id) on delete cascade,
  judge_slot int not null check (judge_slot >= 0 and judge_slot <= 9),
  assigned_at timestamptz not null default now(),
  -- One person per seat, and one seat per person on a given ring: an official
  -- listed twice on the same panel is a mistake every time.
  primary key (ring_id, judge_slot),
  unique (ring_id, official_id)
);

create index if not exists ring_officials_official_idx on public.ring_officials(official_id);

alter table public.ring_officials enable row level security;

-- Who judged this bout, frozen at the moment it was confirmed.
--
-- The assignment on a ring is current, not historical: panels rotate through
-- the day, and by the evening the ring says who is sitting there now rather
-- than who sat there for the quarter-final in question. A result that can be
-- questioned has to carry its own panel.
alter table public.scoreboard_results add column if not exists panel jsonb not null default '[]'::jsonb;
