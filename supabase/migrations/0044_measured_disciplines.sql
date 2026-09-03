-- Power test and special technique.
--
-- Neither is a bout, which is why neither fitted anywhere until now. Nobody
-- faces anybody: each competitor takes a set number of attempts at a set list
-- of techniques, what they achieve is measured, and the category is ranked on
-- the totals. There is no draw, no red and blue corner, and no winner until
-- everybody has been through.
--
-- So they get a table of attempts rather than a bracket. One row per
-- competitor per technique per attempt, which is the grain the result is
-- actually recorded at -- an official calls out "second attempt, three boards"
-- and that is a row. Totals are worked out from the rows and never stored, the
-- same principle the scoreboard already follows: a disputed result can be
-- taken apart attempt by attempt, and correcting one does not mean recomputing
-- anything by hand.

create table if not exists public.event_attempts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  category_id uuid not null references public.event_categories(id) on delete cascade,
  registration_id uuid not null references public.event_registrations(id) on delete cascade,

  -- Which of the discipline's techniques this is. Held as text rather than a
  -- foreign key because the list is the rules' business, not the database's,
  -- and it changes with them -- see src/lib/measured.ts.
  technique text not null,
  attempt_no int not null check (attempt_no between 1 and 10),

  -- What was achieved.
  --
  -- Power test: boards broken. Special technique: the height in centimetres.
  -- One column for both because the arithmetic is the same either way -- take
  -- the best of the attempts at each technique and add them up -- and two
  -- columns would only mean every reader checking which one to look at.
  result numeric not null default 0,

  -- Whether it counted at all. A special technique attempt at 280cm that was
  -- missed scores nothing, and is not the same as an attempt not yet taken --
  -- which is simply the absence of a row.
  scored boolean not null default true,

  recorded_at timestamptz not null default now(),
  recorded_by uuid references public.app_users(id) on delete set null,

  -- One row per attempt. A double-tap on an official's tablet is then a
  -- correction rather than a second attempt appearing from nowhere.
  unique (registration_id, technique, attempt_no)
);

create index if not exists event_attempts_category_idx
  on public.event_attempts(category_id, registration_id);
create index if not exists event_attempts_registration_idx
  on public.event_attempts(registration_id);
create index if not exists event_attempts_recorded_by_idx
  on public.event_attempts(recorded_by);

alter table public.event_attempts enable row level security;
-- No policies: read and written by the server with the service key.

-- How a category of this kind is run: which techniques, and how many attempts
-- at each. Kept per category because a junior power test is not the senior one
-- -- different techniques, and often fewer attempts.
alter table public.event_categories
  add column if not exists measured_techniques text[] not null default '{}',
  add column if not exists attempts_per_technique int not null default 3;
