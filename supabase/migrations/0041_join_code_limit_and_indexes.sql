-- Two unrelated bits of hardening for the scoreboard, kept in one migration
-- because neither is worth a deploy on its own.

-- 1. Slowing down guesses at a ring's join code.
--
-- Five characters is short enough to say across a hall, which is the point of
-- it, but it also means about 33 million combinations and nothing stopping a
-- script from working through them. Counted here rather than in memory because
-- this runs on Vercel, where consecutive requests may land on different
-- instances -- an in-process counter would be reset by the very traffic it is
-- meant to catch.
--
-- Only misses are recorded. A judge holding a good code polls all day and never
-- touches this table after sign-in.

create table if not exists public.join_code_attempts (
  ip text primary key,
  failures int not null default 0,
  first_failure_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

-- For sweeping old rows out; nothing here is worth keeping once it has expired.
create index if not exists join_code_attempts_blocked_idx
  on public.join_code_attempts(blocked_until);

alter table public.join_code_attempts enable row level security;
-- No policies: read and written by the server with the service key, like
-- everything else in this app.

-- 2. Indexes for the foreign keys the database linter flagged.
--
-- Every one of these is a column something actually looks a row up by --
-- carrying a winner into the next bout, listing a bout's presses, finding the
-- rings on a category -- and each was doing it without an index.

create index if not exists event_matches_competitor1_idx
  on public.event_matches(competitor1_registration_id);
create index if not exists event_matches_competitor2_idx
  on public.event_matches(competitor2_registration_id);
create index if not exists event_matches_winner_idx
  on public.event_matches(winner_registration_id);
create index if not exists event_matches_next_idx
  on public.event_matches(next_match_id);
create index if not exists event_matches_loser_next_idx
  on public.event_matches(loser_next_match_id);

create index if not exists scoreboard_entries_match_idx
  on public.scoreboard_entries(match_id);
create index if not exists scoreboard_rings_category_idx
  on public.scoreboard_rings(category_id);
create index if not exists scoreboard_rings_match_idx
  on public.scoreboard_rings(match_id);

create index if not exists event_registrations_student_idx
  on public.event_registrations(student_id);
create index if not exists event_registrations_category_idx
  on public.event_registrations(category_id);
