-- What a bout was scored under, captured when the operator confirms it.
--
-- The presses in scoreboard_entries are the real record, and they are no
-- longer deleted when a ring moves on to the next bout -- they belong to a
-- match_id, so changing the bout on a ring simply changes which presses count.
--
-- Reading a finished bout back needs the mode, the pattern base and how many
-- judges were sitting, and those live on the ring, which moves on within
-- minutes. One row per bout freezes them, so a result opened next week is
-- recomputed exactly as it was called on the day.

create table if not exists public.scoreboard_results (
  match_id uuid primary key references public.event_matches(id) on delete cascade,
  ring_id uuid references public.scoreboard_rings(id) on delete set null,
  mode text not null,
  judge_count int not null,
  pattern_base numeric not null default 10,
  rounds int not null default 1,
  red_name text,
  blue_name text,
  red_number text,
  blue_number text,
  pattern_name text,
  red_votes int not null default 0,
  blue_votes int not null default 0,
  winner_registration_id uuid,
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid
);

create index if not exists scoreboard_results_ring_idx on public.scoreboard_results(ring_id);

alter table public.scoreboard_results enable row level security;
-- No policies: read and written by the server only, like everything else here.
