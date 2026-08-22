-- Live scoreboard: rings and the presses judges make on them.
--
-- A ring is one mat with one bout on it. Judges join by a short code rather
-- than an account, so the code has to be unique on its own.
--
-- Nothing here stores a running total. Every press is a row, and the score is
-- worked out from the rows, so an undo is one row marked void and a disputed
-- bout can be recounted press by press.

create table if not exists public.scoreboard_rings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null default 'Ring 1',
  join_code text not null unique,
  category_id uuid references public.event_categories(id) on delete set null,
  match_id uuid references public.event_matches(id) on delete set null,
  red_name text,
  blue_name text,
  mode text not null default 'sparring' check (mode in ('pattern', 'sparring', 'flag')),
  judge_count int not null default 5 check (judge_count between 1 and 9),
  pattern_base numeric not null default 10,
  round_seconds int not null default 120,
  rounds int not null default 2,
  current_round int not null default 1,
  state text not null default 'idle' check (state in ('idle', 'running', 'paused', 'finished')),
  -- The clock is kept as "started at" plus "seconds left when it was paused",
  -- so every screen works out the same time from its own tick. Broadcasting a
  -- number every second would be a message a second per ring, for no gain.
  clock_started_at timestamptz,
  clock_remaining int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scoreboard_rings_event_idx on public.scoreboard_rings(event_id);

create table if not exists public.scoreboard_entries (
  id uuid primary key default gen_random_uuid(),
  ring_id uuid not null references public.scoreboard_rings(id) on delete cascade,
  match_id uuid references public.event_matches(id) on delete set null,
  judge_slot int not null check (judge_slot between 1 and 9),
  side text not null check (side in ('red', 'blue')),
  kind text not null check (kind in ('point', 'deduction', 'flag')),
  value numeric not null default 0,
  round int not null default 1,
  -- Undo never deletes: a judge taking a press back is itself part of the
  -- record if the bout is ever questioned.
  voided boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists scoreboard_entries_ring_idx on public.scoreboard_entries(ring_id, round);

alter table public.scoreboard_rings enable row level security;
alter table public.scoreboard_entries enable row level security;

-- No policies, deliberately: every read and write goes through the server with
-- the service key, exactly like the rest of this app. The browser's anon key is
-- used for Realtime pings only.

alter table public.scoreboard_rings replica identity full;
alter table public.scoreboard_entries replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.scoreboard_rings;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.scoreboard_entries;
exception when duplicate_object then null;
end $$;
